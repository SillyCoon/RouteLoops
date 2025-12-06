import "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
import "https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.min.js";
//Include valid tokens for routers, if required.
//Also, adjust the callback
//Adjust all DoNotPush

let map, RoutingControl;
let rlPath, rawPath, guidepointPath;
let allPoints;
let currentWaypoints = [];
let directionMarkers = [];
let homeMarker;
const { protocol, hostname, port } = window.location;
const urlParams = new URLSearchParams(window.location.search);
let hasRouteLink = false;
let theConfiguration = {};
let lastCounts = { cleaned: -1, total: -1 };
let newWaypoints = [];

const avoidFerries = "yes";
const method = "random";
const direction = "0";

let homeLocation = null;

window.onload = async () => {
	initMap();

	document.querySelector("#route-loop").addEventListener("click", () => {
		doRL();
	});

	document.querySelector("#createOutput").addEventListener("change", () => {
		generateOutput();
	});

	document.querySelector("#inputMode").addEventListener("change", () => {
		changeMode();
	});
};

async function initMap() {
	if (urlParams.has("routeLink")) hasRouteLink = true;

	map = L.map("map").setView([42.3, -71.3], 8);

	map.on("click", function (event) {
		setAsHome(event.latlng);
		homeLocation = event.latlng;
	});

	const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 18,
		attribution:
			'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	}).addTo(map);

	var theMode = document.getElementById("inputMode").value;
	const theRouter = "MapBox";
	var routerToUse = null;
	if (theRouter == "OSM")
		routerToUse = new L.Routing.OSRMv1({ profile: `${theMode}` });
	if (theRouter == "MapBox") {
		var theToken = "A valid token";
		var theProfile = "cycling";
		if (theMode.indexOf("driving") >= 0) theProfile = "driving";
		if (theMode.indexOf("cycling") >= 0) theProfile = "cycling";
		if (theMode.indexOf("walking") >= 0) theProfile = "walking";
		if (theMode.indexOf("foot") >= 0) theProfile = "walking";
		//Change this to use the input from the query string
		if (urlParams.has("mode")) {
			var mode = urlParams.get("mode");
			if (mode.indexOf("driv") >= 0) theProfile = "driving";
			if (mode.indexOf("car") >= 0) theProfile = "driving";
			if (mode.indexOf("cycl") >= 0) theProfile = "cycling";
			if (mode.indexOf("bik") >= 0) theProfile = "cycling";
			if (mode.indexOf("walk") >= 0) theProfile = "walking";
			if (mode.indexOf("foot") >= 0) theProfile = "walking";
			if (theProfile == "driving")
				document.getElementById("inputMode").value = "driving-car";
			if (theProfile == "cycling")
				document.getElementById("inputMode").value = "cycling-road";
			if (theProfile == "walking")
				document.getElementById("inputMode").value = "foot-walking";
		}
		routerToUse = new L.Routing.mapbox(theToken, {
			profile: `mapbox/${theProfile}`,
		});
	}
	RoutingControl = L.Routing.control({
		waypoints: [],
		lineOptions: { styles: [{ color: "red", opacity: 1, weight: 3 }] },
		router: routerToUse,
	}).addTo(map);

	RoutingControl.on("routesfound", async (response) => {
		var theResponse = response;
		allPoints = [];
		for (const point of theResponse.routes[0].coordinates)
			allPoints.push({ lat: point.lat, lng: point.lng });
		for (const item of theResponse.routes[0].instructions)
			allPoints[item.index].instructions = item.text;
		//Based on the drag action, find the current set of waypoints.
		var newWaypoints = [];
		for (var i = 1; i < theResponse.waypoints.length - 1; i++) {
			var thisWaypoint = theResponse.waypoints[i];
			newWaypoints.push({
				lat: thisWaypoint.latLng.lat,
				lng: thisWaypoint.latLng.lng,
			});
		}
		currentWaypoints.length = 0;
		for (const waypoint of newWaypoints) currentWaypoints.push(waypoint);
		var ApiHeaders = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};
		var data = { allPoints: allPoints };
		var url = `${protocol}//${hostname}:${port}/modifyDirections`;
		var theResp = await fetch(url, {
			method: "POST",
			body: JSON.stringify(data),
			headers: ApiHeaders,
		});
		var theJson = await theResp.json();
		distDisplay = theJson.totalDistanceKm;
		allPoints.length = 0;
		for (const point of theJson.modifiedAllPoints) allPoints.push(point);
		var units = document.getElementById("inputUnits").value;
		if (units == "imperial")
			distDisplay = (distDisplay * 1000 * 100) / 2.54 / 12 / 5280;
		document.getElementById("outDist").innerHTML = distDisplay.toFixed(1);
		try {
			map.removeLayer(rlPath);
		} catch (err) {}
		//Set markers at the locations where you have directions.
		for (const marker of directionMarkers) marker.map = null;
		directionMarkers.length = 0;
		var countInstructions = 0;
		for (const point of allPoints) {
			if (point.hasOwnProperty("instructions")) {
				countInstructions += 1;
				point.count = countInstructions;
				var useInstruction = `${countInstructions}: ${point.instructions}`;
				var marker = new L.Marker([point.lat, point.lng], {
					title: useInstruction,
				});
				marker.addTo(map);
				directionMarkers.push(marker);
			}
		}
		showDirectionMarkers();
	});

	if (hasRouteLink) {
		useRouteLink();
	}

	return;
}
//--------------------------------------
function changeMode() {
	var theMode = document.getElementById("inputMode").value;
	const currentUrl = window.location.href;
	var split = currentUrl.split("?");
	var url = split[0];
	url += `?mode=${theMode}`;
	window.open(url, "_self");
	return;
}
//--------------------------------------
function displayMarker(index) {
	if (index < directionMarkers.length) {
		var marker = directionMarkers[index];
		marker.addTo(map);
		index += 1;
		if (index < directionMarkers.length)
			setTimeout(() => {
				displayMarker(index);
			}, 200);
	}
	return;
}
//.......................................
function showDirectionMarkers() {
	if (document.getElementById("directionMarkers").checked) {
		displayMarker(0);
	} else {
		for (const marker of directionMarkers) map.removeLayer(marker);
	}
	return;
}

//.........................................
async function setAsHome(location) {
	try {
		homeMarker.remove();
	} catch (err) {}

	//Center the map on this location.
	if (typeof waypointsIn == "undefined")
		map.setView(new L.LatLng(location.lat, location.lng));

	//Put a house marker at the start/end point.
	const homeIcon = L.icon({
		iconUrl: "./images/Home.png",
	});

	homeMarker = L.marker([location.lat, location.lng], {
		icon: homeIcon,
		draggable: true,
		title: "Home",
	}).addTo(map);
	homeMarker.on("dragend", function () {
		const position = homeMarker.getLatLng();
		map.setView(position, 18);
	});
	homeLocation = location;
	return { location };
}
//........................................................................................
async function doRL(waypointsIn) {
	//Clear any paths on the map if there are any.
	try {
		map.removeLayer(rlPath);
	} catch (err) {}
	try {
		map.removeLayer(rawPath);
	} catch (err) {}
	try {
		map.removeLayer(guidepointPath);
	} catch (err) {}
	try {
		homeMarker.remove();
	} catch (err) {}

	var initialWaypoints = [];
	if (typeof waypointsIn == "undefined") {
		//Generate points for the route.  These are the guide points generated by some method.
		var theDistance = document.getElementById("inputDist").value;
		var theUnits = document.getElementById("inputUnits").value;
		var theRotation = document.getElementById("inputRotation").value;
		var theDirection = direction;
		var url = `${protocol}//${hostname}:${port}/getRLpoints?lat=${homeLocation.lat}&lng=${homeLocation.lng}`;
		url += `&dist=${theDistance}&units=${theUnits}&rotation=${theRotation}&direction=${theDirection}`;
		var theMethod = method;
		url += `&method=${theMethod}`;
		var theResp = await fetch(url);
		var theJson = await theResp.json();
		var initialWaypoints = JSON.parse(JSON.stringify(theJson));
	} else {
		initialWaypoints = waypointsIn;
	}
	//Add the starting location as both the first, and the last, guide point.
	var guidePoints = [];
	guidePoints.push(new L.LatLng(homeLocation.lat, homeLocation.lng));
	for (const waypoint of initialWaypoints)
		guidePoints.push(new L.LatLng(waypoint.lat, waypoint.lng));
	guidePoints.push(new L.LatLng(homeLocation.lat, homeLocation.lng));

	//Draw these guide points on the map.

	guidepointPath = new L.Polyline(guidePoints, {
		color: "blue",
		weight: 2,
		opacity: 1.0,
		smoothFactor: 1,
	});
	guidepointPath.addTo(map);

	//Get a bounding box used to zoom the map to a more reasonable size.
	const RLBounds = guidepointPath.getBounds();
	if (typeof waypointsIn == "undefined") map.fitBounds(RLBounds);

	//Call the directions service using the guide point as waypoints.
	var theMode = document.getElementById("inputMode").value;
	var inputHighways = document.getElementById("inputHighways").value;
	var inputFerries = avoidFerries;
	var fitnessLevel = document.getElementById("fitnessLevel").value;
	var greenFactor = document.getElementById("greenFactor").value;
	var quietFactor = document.getElementById("quietFactor").value;
	var url = `${protocol}//${hostname}:${port}/directions?lat=${homeLocation.lat}&lng=${homeLocation.lng}`;
	url += `&mode=${theMode}&highways=${inputHighways}&ferries=${inputFerries}`;
	url += `&fitnessLevel=${fitnessLevel}&greenFactor=${greenFactor}&quietFactor=${quietFactor}`;
	var waypointText = "";
	for (const waypoint of initialWaypoints)
		waypointText += `${waypoint.lat},${waypoint.lng}|`;
	waypointText = waypointText.slice(0, -1);
	url += `&waypoints=${waypointText}`;
	var theResp = await fetch(url);
	var theJson = await theResp.json();

	if (theJson.hasOwnProperty("error")) {
		alert(
			`The routing server has returned an error.  Try again with a slightly shorter route.  The error returned was "${theJson.error}"`,
		);
		try {
			map.removeLayer(rlPath);
		} catch (err) {}
		try {
			map.removeLayer(rawPath);
		} catch (err) {}
		try {
			map.removeLayer(guidepointPath);
		} catch (err) {}
		try {
			homeMarker.remove();
		} catch (err) {}
		for (const marker of directionMarkers) map.removeLayer(marker);
		return;
	} else {
		allPoints = theJson.features[0].allPoints;

		//Draw the raw result on the map.  This has not yet been cleaned up by RouteLoops.
		var rawPoints = [];
		for (const point of allPoints)
			rawPoints.push(new L.LatLng(point.lat, point.lng));
		rawPath = new L.Polyline(rawPoints, {
			color: "green",
			weight: 2,
			opacity: 1.0,
			smoothFactor: 1,
		});
		rawPath.addTo(map);

		var cleanTailsJson = {
			cleanedUp: 0,
			distKm: allPoints[allPoints.length - 1].cumulativeDistanceKm,
			newPath: allPoints,
		};

		//Call a cleaning function until the result stabilizes
		var ApiHeaders = {
			Accept: "application/json",
			"Content-Type": "application/json",
		};
		var keepGoing = true;
		if (hasRouteLink) {
			keepGoing = false;
			hasRouteLink = false; //Reset this so that from now on it will perform the route cleaning
		}
		var countCalcs = 0;
		var waypoints = [];
		for (const waypoint of initialWaypoints) waypoints.push(waypoint);
		lastCounts = { cleaned: -1, total: -1 };
		while (keepGoing) {
			countCalcs += 1;

			//Take allPoints and clean up the path.
			var data = { LLs: allPoints };
			var url = `${protocol}//${hostname}:${port}/cleanTails`;
			var theResp = await fetch(url, {
				method: "POST",
				body: JSON.stringify(data),
				headers: ApiHeaders,
			});
			var cleanTailsJson = await theResp.json();

			if (cleanTailsJson.cleanedUp > 0) {
				//You modified the path, so redo the whole thing with this modified path.
				//Generate the new set of allPoints.
				allPoints.length = 0;
				for (const point of cleanTailsJson.newPath) allPoints.push(point);

				//Based on the new allPoints, find the current set of waypoints.  Choose the closest points to the previous waypoints.
				newWaypoints = [];
				for (const waypoint of waypoints) {
					var closest = null;
					for (const point of allPoints) {
						var separation =
							Math.pow(waypoint.lat - point.lat, 2) +
							Math.pow(waypoint.lng - point.lng, 2);
						if (closest == null)
							closest = { point: point, separation: separation };
						if (separation < closest.separation)
							closest = { point: point, separation: separation };
					}
					newWaypoints.push(closest.point);
				}
				waypoints.length = 0;
				for (const waypoint of newWaypoints) waypoints.push(waypoint);

				//Generate a new path based on this new set of waypoints.
				var url = `${protocol}//${hostname}:${port}/directions?lat=${homeLocation.lat}&lng=${homeLocation.lng}`;
				url += `&mode=${theMode}&highways=${inputHighways}&ferries=${inputFerries}`;
				url += `&fitnessLevel=${fitnessLevel}&greenFactor=${greenFactor}&quietFactor=${quietFactor}`;
				var waypointText = "";
				for (const waypoint of waypoints)
					waypointText += `${waypoint.lat},${waypoint.lng}|`;
				waypointText = waypointText.slice(0, -1);
				url += `&waypoints=${waypointText}`;
				var theResp = await fetch(url);
				var directionsJson = await theResp.json();
				allPoints = directionsJson.features[0].allPoints;
			} else {
				//No change, so that's it.
				keepGoing = false;
			}

			if (
				cleanTailsJson.cleanedUp == lastCounts.cleaned &&
				allPoints.length == lastCounts.total
			) {
				//The modifications are not changing, so stop
				keepGoing = false;
			} else {
				lastCounts = {
					cleaned: cleanTailsJson.cleanedUp,
					total: allPoints.length,
				};
			}
		}

		var distDisplay = cleanTailsJson.distKm;
		var units = document.getElementById("inputUnits").value;
		if (units == "imperial")
			distDisplay = (distDisplay * 1000 * 100) / 2.54 / 12 / 5280;
		document.getElementById("outDist").innerHTML = distDisplay.toFixed(1);
		document.getElementById("calcs").innerHTML = countCalcs;

		//Draw the cleaned result on the map.
		var rlPoints = [];
		for (const point of allPoints)
			rlPoints.push(new L.LatLng(point.lat, point.lng));
		rlPath = new L.Polyline(rlPoints, {
			color: "red",
			weight: 3,
			opacity: 1.0,
			smoothFactor: 1,
		});
		rlPath.addTo(map);

		//Remove the other lines if that's desired.
		//var yes = confirm("Remove other lines?");
		var yes = true;
		if (yes) {
			map.removeLayer(rawPath);
			map.removeLayer(guidepointPath);
		}

		currentWaypoints = JSON.parse(JSON.stringify(waypoints));

		//This is a special section for OSM, to enable draggable routes.
		var wpts = [];
		wpts.push(new L.LatLng(homeLocation.lat, homeLocation.lng));
		for (const waypoint of waypoints)
			wpts.push(new L.LatLng(waypoint.lat, waypoint.lng));
		wpts.push(new L.LatLng(homeLocation.lat, homeLocation.lng));
		RoutingControl.setWaypoints(wpts);

		return;
	}
}

//......................................................................................................
async function generateOutput() {
	var theType = document.getElementById("createOutput").value;
	if (theType === "none") return;

	var routeName = document.getElementById("routeName").value.trim();
	var units = document.getElementById("inputUnits").value;
	var mode = document.getElementById("inputMode").value;
	var advanceUnits = "meters";
	var pace = "kph";
	var paceDefault = 25;
	if (mode === "walking") {
		pace = "minutes-per-kilometer";
		paceDefault = 6; //min per km
	}
	if (units === "imperial") {
		advanceUnits = "feet";
		pace = "mph";
		paceDefault = 16;
		if (mode === "walking") {
			pace = "minutes-per-mile";
			packetDefault = 10; //min per mile
		}
	}

	const ApiHeaders = {
		Accept: "application/json",
		"Content-Type": "application/json",
	};

	let doPrint = false;
	let doShow = false;

	if (theType === "directions") {
		let speed = prompt(`Your average ${mode} speed in ${pace}.`, paceDefault);
		if (pace.indexOf("minutes-per") >= 0) speed = 60 / speed;
		const data = { allPoints: allPoints, units: units, speed: speed };
		const url = `${protocol}//${hostname}:${port}/showDirections`;
		const theResp = await fetch(url, {
			method: "POST",
			body: JSON.stringify(data),
			headers: ApiHeaders,
		});
		var theJson = await theResp.json();
		doPrint = confirm("Print it?");
		doShow = true;
	}

	if (theType === "sparseGPX") {
		const data = { allPoints: allPoints };
		const url = `${protocol}//${hostname}:${port}/makeSparseGPX`;
		const theResp = await fetch(url, {
			method: "POST",
			body: JSON.stringify(data),
			headers: ApiHeaders,
		});
		var theJson = await theResp.json();
		doPrint = true;
	}

	if (theType === "denseGPX") {
		let speed = prompt(`Your average ${mode} speed in ${pace}.`, paceDefault);
		if (pace.indexOf("minutes-per") >= 0) speed = 60 / speed;
		const data = { allPoints: allPoints, units: units, speed: speed };
		const url = `${protocol}//${hostname}:${port}/makeDenseGPX`;
		const theResp = await fetch(url, {
			method: "POST",
			body: JSON.stringify(data),
			headers: ApiHeaders,
		});
		var theJson = await theResp.json();
		doPrint = true;
	}

	if (theType === "tcx") {
		let speed = prompt(`Your average ${mode} speed in ${pace}.`, paceDefault);
		if (pace.indexOf("minutes-per") >= 0) speed = 60 / speed;
		const advance = prompt(
			`Set turn warnings this many ${advanceUnits} in advance.`,
			300,
		);
		const data = {
			allPoints: allPoints,
			units: units,
			speed: speed,
			advance: advance,
			name: routeName,
		};
		const url = `${protocol}//${hostname}:${port}/makeTCX`;
		const theResp = await fetch(url, {
			method: "POST",
			body: JSON.stringify(data),
			headers: ApiHeaders,
		});
		var theJson = await theResp.json();
		doPrint = true;
	}

	if (theType === "google") {
		doPrint = false;
		const start = `${allPoints[0].lat},${allPoints[0].lng}`;
		const destination = `${allPoints[0].lat},${allPoints[0].lng}`;
		let waypoints = "";
		for (const waypoint of currentWaypoints)
			waypoints += `${waypoint.lat},${waypoint.lng}|`;
		waypoints = waypoints.slice(0, -1);
		const inputMode = document.getElementById("inputMode").value;
		let travelmode = "bicycling";
		if (inputMode.indexOf("driving") >= 0) travelmode = "driving";
		if (inputMode.indexOf("foot") >= 0) travelmode = "walking";
		const url = `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${destination}&waypoints=${waypoints}&dir_action=navigate&travelmode=${travelmode}`;
		alert(
			`This will open a new window with the "anchor" points displayed on Google Maps.  Google will do its own routing, which is very likely NOT going to be the same as the RouteLoops routing.`,
		);
		window.open(url, "_blank");
		var theJson = { status: "google" };
	}

	if (theType === "link") {
		saveConfiguration();
		doPrint = false;
		var theJson = { status: "link" };
	}

	if (theJson.status === "OK") {
		let theInfo = "";
		let theType = "";
		if (theJson.hasOwnProperty("html")) {
			theInfo = theJson.html;
			theType = "html";
		}
		if (theJson.hasOwnProperty("gpx")) {
			theInfo = theJson.gpx;
			theType = "gpx";
		}
		if (theJson.hasOwnProperty("tcx")) {
			theInfo = theJson.tcx;
			theType = "tcx";
		}

		if (doShow) {
			const winUrl = URL.createObjectURL(
				new Blob([theInfo], { type: "text/html" }),
			);

			window.open(
				winUrl,
				"win",
				`width=800,height=400,screenX=200,screenY=200`,
			);
		}

		if (doPrint) {
			let useName = theJson.name;
			if (routeName.length > 0) useName = routeName;
			const blob = new Blob([theInfo], { type: "text/html" });
			saveAs(blob, `${useName}.${theType}`);
		}
	}

	document.getElementById("createOutput").value = "none";
	return;
}

//............................................................
function saveConfiguration() {
	theConfiguration = {};
	theConfiguration.inputLocation = homeLocation;
	theConfiguration.inputDist = document.getElementById("inputDist").value;
	theConfiguration.inputUnits = document.getElementById("inputUnits").value;
	theConfiguration.inputMode = document.getElementById("inputMode").value;
	theConfiguration.fitnessLevel = document.getElementById("fitnessLevel").value;
	theConfiguration.greenFactor = document.getElementById("greenFactor").value;
	theConfiguration.quietFactor = document.getElementById("quietFactor").value;
	theConfiguration.inputRotation =
		document.getElementById("inputRotation").value;
	theConfiguration.inputDirection = direction;
	theConfiguration.method = method;
	theConfiguration.inputHighways =
		document.getElementById("inputHighways").value;
	theConfiguration.inputFerries = avoidFerries;
	theConfiguration.currentWaypoints = currentWaypoints;

	var theLink = "";
	theLink = `${protocol}//${hostname}:${port}/index.html`;
	theLink += "?routeLink=true";
	for (const item in theConfiguration) {
		if (item != "currentWaypoints")
			theLink += `&${item}=${theConfiguration[item]}`;
	}
	if (currentWaypoints.length > 0) {
		var text = "";
		for (const waypoint of currentWaypoints)
			text += `${waypoint.lat},${waypoint.lng}|`;
		text = text.slice(0, -1);
		theLink += `&waypoints=${text}`;
	}

	console.log(theLink);

	const newWindow = window.open("", "_blank", "width=800,height=200");
	if (newWindow) {
		newWindow.document.open();
		newWindow.document.write(theLink);
		//newWindow.document.close();
	} else {
		alert("Popup blocked! Please allow popups for this site.");
	}

	return;
}

//..................................................................
function useRouteLink() {
	if (urlParams.has("inputLocation"))
		homeLocation = urlParams.get("inputLocation");
	if (urlParams.has("inputDist"))
		document.getElementById("inputDist").value = urlParams.get("inputDist");
	if (urlParams.has("inputUnits"))
		document.getElementById("inputUnits").value = urlParams.get("inputUnits");
	if (urlParams.has("inputMode")) {
		var useMode = "cycling-road";
		if (urlParams.get("inputMode").toLowerCase().indexOf("driv") >= 0)
			useMode = "driving-car";
		if (urlParams.get("inputMode").toLowerCase().indexOf("walk") >= 0)
			useMode = "foot-walking";
		if (urlParams.get("inputMode").toLowerCase().indexOf("hik") >= 0)
			useMode = "foot-hiking";
		document.getElementById("inputMode").value = useMode;
	}
	if (urlParams.has("fitnessLevel"))
		document.getElementById("fitnessLevel").value =
			urlParams.get("fitnessLevel");
	if (urlParams.has("greenFactor"))
		document.getElementById("greenFactor").value = urlParams.get("greenFactor");
	if (urlParams.has("quietFactor"))
		document.getElementById("quietFactor").value = urlParams.get("quietFactor");
	if (urlParams.has("inputRotation"))
		document.getElementById("inputRotation").value =
			urlParams.get("inputRotation");
	if (urlParams.has("inputHighways"))
		document.getElementById("inputHighways").value =
			urlParams.get("inputHighways");
	var waypoints = [];
	var pts = [];
	if (urlParams.has("waypoints")) {
		pts = urlParams.get("waypoints");
		pts = pts.split("|");
		for (item of pts) {
			var pair = item.split(",");
			waypoints.push({ lat: pair[0], lng: pair[1] });
		}
	}

	doRL(waypoints);

	return;
}
