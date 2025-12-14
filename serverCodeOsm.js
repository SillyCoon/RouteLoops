import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { getRLpoints } from "./rlpoints.js";
import { cleanDirections } from "./cleanDirections.js";
import dotenv from "dotenv";
dotenv.config();

import { parseQuery as parseRLQuery } from "./rlpoints.js";
import { parseQuery as parseDirectionsQuery } from "./directions.js";

var app = express();
app.use(cors());
app.use(express.static("./"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.get("/getRLpoints", (req, res) =>
	getRLpoints(parseRLQuery(req.url)).then((data) => res.json(data)),
);
app.get("/cleanDirections", async (req, res) => {
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders();

	res.on("close", () => {
		console.log("client dropped me");
		res.end();
	});

	for await (const data of cleanDirections(parseDirectionsQuery(req.url))) {
		if (data.iteration === 0) {
			res.write("event: start\n");
		} else {
			res.write("event: refinement\n");
		}
		res.write(`data: ${JSON.stringify(data)}\n\n`);
	}
});

app.post("/showDirections", showDirections);
app.post("/makeSparseGPX", makeSparseGPX);
app.post("/makeDenseGPX", makeDenseGPX);
app.post("/makeTCX", makeTCX);

// Setup Server
const thePort = 8080;
app.listen(thePort, function () {
	console.log(`Server has been started and is listening on port ${thePort}`);
});

/*/
//Secure Server
import https from 'https';
https.createServer(
		{
	key: fs.readFileSync('/etc/letsencrypt/live/routeloops.com/privkey.pem'),
	cert: fs.readFileSync('/etc/letsencrypt/live/routeloops.com/cert.pem'),
	ca: fs.readFileSync('/etc/letsencrypt/live/routeloops.com/fullchain.pem')
		},app
	)
	.listen(8443, () => {
		console.log('Listening on 8443 ...')
	})
//*/

//Use this to hold the request token, request token secret pairs.
var secrets = {
	"310fd994-6c6f-4a38-8582-16cb3edf743b": {
		secret: "LkjNDk4xZQJyY0S9Wik5KNe6bvG097fuYww",
		timestamp: 1743559197,
	},
};

function cleanUpOldSecrets() {
	//Clean up old secrets
	var oldestAllowed = 24 * 60 * 60;
	var itIsNow = Math.floor(Date.now() / 1000);
	var removed = 0;
	for (const token in secrets) {
		if (itIsNow - secrets[token]["timestamp"] > oldestAllowed) {
			console.log(
				`Removing the secret associated with token ${token} due to age.`,
			);
			delete secrets[token];
			removed += 1;
		}
	}
	if (removed == 0)
		console.log(
			`No tokens have yet aged out.  I am holding onto secrets for ${Object.keys(secrets).length} tokens.`,
		);
	return;
}
cleanUpOldSecrets();
const cleanUpInterval = setInterval(
	function () {
		cleanUpOldSecrets();
	},
	24 * 60 * 60 * 1000,
);

// directions handler moved to ./directions.js

//..............................................................
function showDirections(req, res, next) {
	var method = req.method;
	var url = req.url;
	if (method.toLowerCase() == "get") {
	} else if (method.toLowerCase() == "post") {
		var body = req.body;
		/*
		var directions = body.directions;
		var status = "OK";
		var theHTML = "";
	
		var error = "ERROR";
		try{
				var theRoute = directions.routes[0];
				error = "";
		}
		catch(err){}
	
		if(error!=""){
				status = "NG";
				theHTML = `< h1 > Problem getting a route when trying to generate directions.</h1 > `;
		}
		*/

		var allPoints = body.allPoints;
		var units = body.units;
		var speed = body.speed;
		if (isNaN(speed)) speed = 10;
		if (speed <= 0) speed = 10;
		var displayUnits = "kilometers";
		if (units == "imperial") displayUnits = "miles";

		var status = "OK";
		var theHTML = "";
		if (allPoints.length <= 0) {
			status = "NG";
			theHTML = `< h1 > No points brought in for directions display.</h1 > `;
		} else {
			var currentTime = new Date();
			var year = currentTime.getFullYear();
			var month = currentTime.getMonth() + 1;
			var day = currentTime.getDate();
			var hour = currentTime.getHours();
			var minute = currentTime.getMinutes();
			var name =
				"RL-" +
				year +
				"-" +
				padZeros(month, 2) +
				"-" +
				padZeros(day, 2) +
				"-" +
				padZeros(hour, 2) +
				padZeros(minute, 2);
			var ymd = year + "-" + padZeros(month, 2) + "-" + padZeros(day, 2);

			theHTML = "";

			theHTML += "<html><head><title>" + name + "</title>";
			theHTML += "</head><body>";

			theHTML += `< style > `;
			theHTML += `table, th, td {
						`;
			theHTML += `  border: 1px solid black; `;
			theHTML += `  border - collapse: collapse; `;
			theHTML += `} `;
			theHTML += `tr: nth - child(even) {
						`;
			theHTML += `  background - color: rgba(150, 212, 212, 0.4); `;
			theHTML += `} `;
			theHTML += `th: nth - child(even), td: nth - child(even) {
						`;
			theHTML += `  background - color: rgba(150, 212, 212, 0.4); `;
			theHTML += `} `;
			theHTML += `</style > `;

			var totalDistanceKm =
				allPoints[allPoints.length - 1].cumulativeDistanceKm;
			var totalDistance = showDist(totalDistanceKm, units);
			var duration = totalDistance / speed;
			theHTML += `${totalDistance.toFixed(1)} ${displayUnits} & nbsp;& nbsp; about & nbsp;& nbsp; ${convertHoursToHMS(duration)} at ${speed} ${displayUnits} /hour.</br > `;
			theHTML += "<table>";
			theHTML += "<tr>";
			theHTML += `< th ></th > <th>Instruction</th> <th>${displayUnits} to next</th><th>${displayUnits} total</th>`;
			theHTML += "</tr>";
			var theIndex = 0;
			for (var i = 0; i < allPoints.length; i++) {
				if (!allPoints[i].hasOwnProperty("instructions")) continue;
				theIndex += 1;
				theHTML += "<tr>";
				theHTML += `< td > ${theIndex}.</td > <td>${allPoints[i].instructions}</td> <td>${showDist(allPoints[i].distanceToNextKm, units).toFixed(1)}</td>`;
				theHTML += `< td > ${showDist(allPoints[i].distanceToNextKm + allPoints[i].cumulativeDistanceKm, units).toFixed(1)}</td > `;
				theHTML += "</tr>";
			}
			theHTML += "</table>";
			theHTML += "</body></html>";
		}

		res.json({ status: status, html: theHTML, name: name });
	}
}

//..............................................................
function makeSparseGPX(req, res, next) {
	var method = req.method;
	var url = req.url;
	if (method.toLowerCase() == "get") {
	} else if (method.toLowerCase() == "post") {
		var body = req.body;

		var allPoints = body.allPoints;
		var status = "OK";

		var currentTime = new Date();
		var year = currentTime.getFullYear();
		var month = currentTime.getMonth() + 1;
		var day = currentTime.getDate();
		var hour = currentTime.getHours();
		var minute = currentTime.getMinutes();
		var name =
			"RL-" +
			year +
			"-" +
			padZeros(month, 2) +
			"-" +
			padZeros(day, 2) +
			"-" +
			padZeros(hour, 2) +
			padZeros(minute, 2);
		var ymd = year + "-" + padZeros(month, 2) + "-" + padZeros(day, 2);
		var OutText = "";

		OutText += '<?xml version="1.0"?>';
		OutText += "\n";

		//OutText+= "<!--\n";
		//OutText+= storeURL();
		//OutText+= "\n-->\n";

		OutText +=
			'<gpx version="1.0" creator="ExpertGPS 1.1 - http://www.topografix.com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd">\n';

		OutText += "<rte>\n";
		for (var i = 0; i < allPoints.length; i++) {
			if (i == 0) {
				var Lat = allPoints[i].lat;
				var Lng = allPoints[i].lng;
				OutText += '   <rtept lat="' + Lat + '" lon="' + Lng + '">\n';
				OutText += "   <name> p" + 0 + "</name>\n";
				OutText += "   <desc><![CDATA[Start]]></desc>\n";
				OutText += "   </rtept>\n";
			} else {
				if (!allPoints[i].hasOwnProperty("instructions")) continue;
				var Lat = allPoints[i].lat;
				var Lng = allPoints[i].lng;
				var instruction = cleanUp(allPoints[i].instructions);
				var point = i + 1;
				OutText += '   <rtept lat="' + Lat + '" lon="' + Lng + '">\n';
				OutText += "   <name> p" + point + "</name>\n";
				OutText += "   <desc><![CDATA[" + instruction + "]]></desc>\n";
				OutText += "   </rtept>\n";
			}
		}
		OutText += "</rte>\n";
		OutText += "</gpx>\n";

		res.json({ status: status, gpx: OutText, name: name });
	}
}

//..............................................................
function makeDenseGPX(req, res, next) {
	var method = req.method;
	var url = req.url;
	if (method.toLowerCase() == "get") {
	} else if (method.toLowerCase() == "post") {
		var body = req.body;
		var units = body.units;
		var speed = body.speed;
		if (isNaN(speed)) speed = 10;
		if (speed <= 0) speed = 10;
		var displayUnits = "kilometers";
		if (units == "imperial") displayUnits = "miles";
		var speedKph = speed;
		if (units == "imperial") speedKph = (speed * 5280 * 12 * 2.54) / 100 / 1000;

		var allPoints = body.allPoints;
		var status = "OK";

		//Update allPoints with times.
		var lastTime = null;
		for (var point of allPoints) {
			Time = (point.cumulativeDistanceKm / speedKph) * 60 * 60;
			Time = Math.round(Time); //Get rid of fractional seconds because they can lead to odd times, like 3 minutes and 60 seconds.
			if (Time == lastTime) Time += 1;
			point.time = Time;
			lastTime = Time;
		}

		var currentTime = new Date();
		var year = currentTime.getFullYear();
		var month = currentTime.getMonth() + 1;
		var day = currentTime.getDate();
		var hour = currentTime.getHours();
		var minute = currentTime.getMinutes();
		var name =
			"RL-" +
			year +
			"-" +
			padZeros(month, 2) +
			"-" +
			padZeros(day, 2) +
			"-" +
			padZeros(hour, 2) +
			padZeros(minute, 2);
		var ymd = year + "-" + padZeros(month, 2) + "-" + padZeros(day, 2);
		var OutText = "";

		OutText += '<?xml version="1.0"?>\n';
		//OutText += "<!--\n";
		//OutText += storeURL() + "\n";
		//OutText += "-->\n";
		OutText +=
			'<gpx version="1.0" creator="ExpertGPS 1.1 - http://www.topografix.com" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd">\n';

		OutText += "<trk>\n";
		OutText += "  <trkseg>\n";

		for (var i = 0; i < allPoints.length; i++) {
			var Lat = allPoints[i].lat;
			var Lng = allPoints[i].lng;
			OutText += '    <trkpt lat="' + Lat + '" lon="' + Lng + '">\n';
			OutText += "    <name> p" + i + " </name>\n";
			var Time = allPoints[i].time;
			OutText +=
				"    <time>" +
				ymd +
				"T" +
				padZeros(hours(Time).toFixed(0), 2) +
				":" +
				padZeros(minutes(Time).toFixed(0), 2) +
				":" +
				padZeros(seconds(Time).toFixed(0), 2) +
				"Z</time>\n";
			OutText += "    </trkpt>\n";
		}
		OutText += "  </trkseg>\n";
		OutText += "</trk>\n";
		OutText += "</gpx>\n";
		res.json({ status: status, gpx: OutText, name: name });
	}
}

//..............................................................
function makeTCX(req, res, next) {
	var method = req.method;
	var url = req.url;
	if (method.toLowerCase() == "get") {
	} else if (method.toLowerCase() == "post") {
		var body = req.body;
		var units = body.units;
		var speed = body.speed;
		var advance = body.advance;
		var name = body.name;
		if (isNaN(speed)) speed = 10;
		if (speed <= 0) speed = 10;
		var displayUnits = "kilometers";
		if (units == "imperial") displayUnits = "miles";
		var speedKph = speed;
		if (units == "imperial") speedKph = (speed * 5280 * 12 * 2.54) / 100 / 1000;
		var advanceMeters = advance;
		if (units == "imperial") advanceMeters = (advance * 12 * 2.54) / 100;

		var allPoints = body.allPoints;
		var status = "OK";

		//Update allPoints with times.
		var lastTime = null;
		for (var point of allPoints) {
			Time = (point.cumulativeDistanceKm / speedKph) * 60 * 60;
			Time = Math.round(Time); //Get rid of fractional seconds because they can lead to odd times, like 3 minutes and 60 seconds.
			if (Time == lastTime) Time += 1;
			point.time = Time;
			lastTime = Time;
		}

		//Create a list of warnings in advance
		for (const point of allPoints) {
			if (!point.hasOwnProperty("instructions")) continue;
			var atDistance = point.cumulativeDistanceKm;
			var advancedDistance = atDistance - advanceMeters / 1000;
			var result = findPointAtDistance(allPoints, advancedDistance);
			if (result.atPoint != null)
				allPoints[result.atPoint].advancedInstructions = point.instructions;
		}

		var currentTime = new Date();
		var year = currentTime.getFullYear();
		var month = currentTime.getMonth() + 1;
		var day = currentTime.getDate();
		var hour = currentTime.getHours();
		var minute = currentTime.getMinutes();
		if (name.length == 0)
			name =
				"RL-" +
				year +
				"-" +
				padZeros(month, 2) +
				"-" +
				padZeros(day, 2) +
				"-" +
				padZeros(hour, 2) +
				padZeros(minute, 2);
		var ymd = year + "-" + padZeros(month, 2) + "-" + padZeros(day, 2);
		var OutText = "";

		OutText += '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
		OutText +=
			'<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n';
		OutText += "<Courses>\n";
		OutText += "  <Course>\n";
		OutText += "  <Name>" + name + "</Name>\n";

		//Write out all of the Track Points
		OutText += "  <Track>\n";
		for (var i = 0; i < allPoints.length; i++) {
			OutText += "    <Trackpoint>\n";
			OutText += "      <Position>\n";
			var Lat = allPoints[i].lat;
			OutText += "        <LatitudeDegrees>" + Lat + "</LatitudeDegrees>\n";
			var Lng = allPoints[i].lng;
			OutText += "        <LongitudeDegrees>" + Lng + "</LongitudeDegrees>\n";
			var Dist = allPoints[i].cumulativeDistanceKm;
			var Time = allPoints[i].time;
			OutText += "      </Position>\n";
			OutText +=
				"      <DistanceMeters>" +
				(Dist * 1000).toFixed(0) +
				"</DistanceMeters>\n";
			OutText +=
				"      <Time>" +
				ymd +
				"T" +
				padZeros(hours(Time).toFixed(0), 2) +
				":" +
				padZeros(minutes(Time).toFixed(0), 2) +
				":" +
				padZeros(seconds(Time).toFixed(0), 2) +
				"Z</Time>\n";
			OutText += "    </Trackpoint>\n";
		}
		OutText += "  </Track>\n";

		//Write out all of the Course Points
		for (var i = 0; i < allPoints.length; i++) {
			if (!allPoints[i].hasOwnProperty("advancedInstructions")) continue;

			var instruct = allPoints[i].advancedInstructions;
			if (instruct[instruct.length - 1] == "*")
				instruct = instruct.slice(0, -1);
			//Figure out the direction
			{
				var type = "Generic";
				if (instruct.indexOf("left") >= 0) type = "Left";
				else if (instruct.indexOf("right") >= 0) type = "Right";
				else if (instruct.indexOf("Continue") >= 0) type = "Straight";
			}
			// Figure out the road
			{
				var point = null,
					road = "";
				if (instruct.indexOf(" at ") >= 0) {
					point = instruct.indexOf(" at ");
					road = instruct.substring(point + 3);
				} else if (instruct.indexOf(" onto ") >= 0) {
					point = instruct.indexOf(" onto ");
					road = instruct.substring(point + 5);
				} else if (instruct.indexOf(" on ") >= 0) {
					point = instruct.indexOf(" on ");
					road = instruct.substring(point + 3);
				}
			}
			var Lat = allPoints[i].lat;
			var Lng = allPoints[i].lng;
			var Time = allPoints[i].time;
			//alert("Writing item " + i + " of " + alerts + " which is" + instruct);
			OutText += "  <CoursePoint>\n";
			var roadOut = cleanUp(road);
			OutText += "    <Name>" + roadOut + "</Name>\n";
			OutText +=
				"    <Time>" +
				ymd +
				"T" +
				padZeros(hours(Time).toFixed(0), 2) +
				":" +
				padZeros(minutes(Time).toFixed(0), 2) +
				":" +
				padZeros(seconds(Time).toFixed(0), 2) +
				"Z</Time>\n";
			OutText += "    <Position>\n";
			OutText += "      <LatitudeDegrees>" + Lat + "</LatitudeDegrees>\n";
			OutText += "      <LongitudeDegrees>" + Lng + "</LongitudeDegrees>\n";
			OutText += "    </Position>\n";
			OutText += "    <PointType>" + type + "</PointType>\n";
			var instructions = cleanUp(instruct);
			OutText += "    <Notes><![CDATA[" + instructions + "]]></Notes>\n";
			OutText += "  </CoursePoint>\n";
		}

		OutText += "</Course>\n";
		OutText += "</Courses>\n";
		OutText += "</TrainingCenterDatabase>\n";

		res.json({ status: status, tcx: OutText, name: name });
	}
}

//..................................................................
function findPointAtDistance(allPoints, distanceKm) {
	var result = { atPoint: null, withSeparation: null };
	for (var a = 0; a < allPoints.length; a++) {
		var separation = Math.abs(allPoints[a].cumulativeDistanceKm - distanceKm);
		if (result.atPoint == null)
			result = { atPoint: a, withSeparation: separation };
		if (separation < result.withSeparation)
			result = { atPoint: a, withSeparation: separation };
	}

	return result;
}

//..................................................................
function padZeros(theNumber, max) {
	var numStr = String(theNumber);

	while (numStr.length < max) {
		numStr = "0" + numStr;
	}

	return numStr;
}
//..................................................................
function convertHoursToHMS(hours) {
	const totalSeconds = Math.floor(hours * 3600);
	const hrs = Math.floor(totalSeconds / 3600);
	const remainingSeconds = totalSeconds % 3600;
	const mins = Math.floor(remainingSeconds / 60);
	const secs = remainingSeconds % 60;

	return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")} `;
}
//...............................................................
function hours(secs) {
	return Math.floor(Math.max(secs, 0) / 3600.0);
}
//...............................................................
function minutes(secs) {
	return Math.floor((Math.max(secs, 0) % 3600.0) / 60.0);
}
//...............................................................
function seconds(secs) {
	return Math.round(Math.max(secs, 0) % 60.0);
}
//..................................................................
function showDist(km, units) {
	var showAs = km;
	if (units == "imperial") showAs = (km * 1000 * 100) / 2.54 / 12 / 5280;
	if (units == "metric") showAs = km;
	return showAs;
}
//...............................................................................................
function cleanUp(text) {
	var cleaned;

	cleaned = text;
	if (typeof cleaned == "undefined") cleaned = "";

	//Get rid of any HTML tags.
	while (cleaned.indexOf("<") >= 0) {
		var from = cleaned.indexOf("<");
		var to = cleaned.indexOf(">");
		var end = from;
		var start = to + 1;
		var first = cleaned.slice(0, end);
		var last = cleaned.slice(start, cleaned.length);
		cleaned = first + last;
	}

	//Also there appear to be stars, from time to time.
	while (cleaned.indexOf("*") >= 0) {
		var end = cleaned.indexOf("*");
		var first = cleaned.slice(0, end);
		var last = cleaned.slice(end + 1, cleaned.length);
		cleaned = first + last;
	}

	return cleaned;
}
