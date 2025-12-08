import "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
//Include valid tokens for routers, if required.
//Also, adjust the callback
//Adjust all DoNotPush

let map;
let rlPath, rawPath, guidepointPath;
let allPoints;
let currentWaypoints = [];
let homeMarker;
const { protocol, hostname, port } = window.location;
const urlParams = new URLSearchParams(window.location.search);
let hasRouteLink = false;
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

	map.on("click", (event) => {
		setAsHome(event.latlng);
		homeLocation = event.latlng;
	});

	L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
		maxZoom: 18,
		attribution:
			'&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
	}).addTo(map);

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

//.........................................
async function setAsHome(location) {
	try {
		homeMarker.remove();
	} catch { }

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
	homeMarker.on("dragend", () => {
		const position = homeMarker.getLatLng();
		map.setView(position, 18);
	});
	homeLocation = location;
	return { location };
}

const getRLpoints = async () => {
	const theDistance = document.getElementById("inputDist").value;
	const theUnits = document.getElementById("inputUnits").value;
	const theRotation = document.getElementById("inputRotation").value;
	const theDirection = direction;
	let url = `${protocol}//${hostname}:${port}/getRLpoints?lat=${homeLocation.lat}&lng=${homeLocation.lng}`;
	url += `&dist=${theDistance}&units=${theUnits}&rotation=${theRotation}&direction=${theDirection}`;
	const theMethod = method;
	url += `&method=${theMethod}`;
	const theResp = await fetch(url);
	const theJson = await theResp.json();
	const initialWaypoints = JSON.parse(JSON.stringify(theJson));
	return initialWaypoints;
};

const drawGuidePoints = (waypoints, waypointsIn) => {
	//Add the starting location as both the first, and the last, guide point.
	const guidePoints = [];
	guidePoints.push(new L.LatLng(homeLocation.lat, homeLocation.lng));
	for (const waypoint of waypoints)
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
	if (!waypointsIn) map.fitBounds(RLBounds);
};

const getDirections = async (initialWaypoints) => {
	//Call the directions service using the guide point as waypoints.
	const theMode = document.getElementById("inputMode").value;
	const inputHighways = document.getElementById("inputHighways").value;
	const inputFerries = avoidFerries;
	const fitnessLevel = document.getElementById("fitnessLevel").value;
	const greenFactor = document.getElementById("greenFactor").value;
	const quietFactor = document.getElementById("quietFactor").value;
	let url = `${protocol}//${hostname}:${port}/directions?lat=${homeLocation.lat}&lng=${homeLocation.lng}`;
	url += `&mode=${theMode}&highways=${inputHighways}&ferries=${inputFerries}`;
	url += `&fitnessLevel=${fitnessLevel}&greenFactor=${greenFactor}&quietFactor=${quietFactor}`;
	let waypointText = "";
	for (const waypoint of initialWaypoints)
		waypointText += `${waypoint.lat},${waypoint.lng}|`;
	waypointText = waypointText.slice(0, -1);
	url += `&waypoints=${waypointText}`;
	const theResp = await fetch(url);
	return await theResp.json();
};

const cleanMap = () => {
	//Clear any paths on the map if there are any.
	try {
		map.removeLayer(rlPath);
	} catch { }
	try {
		map.removeLayer(rawPath);
	} catch { }
	try {
		map.removeLayer(guidepointPath);
	} catch { }
	try {
		homeMarker.remove();
	} catch { }
};

const improveDirections = async (allPoints, initialWaypoints) => {
	//Draw the raw result on the map.  This has not yet been cleaned up by RouteLoops.
	const rawPoints = [];
	for (const point of allPoints)
		rawPoints.push(new L.LatLng(point.lat, point.lng));
	rawPath = new L.Polyline(rawPoints, {
		color: "green",
		weight: 2,
		opacity: 1.0,
		smoothFactor: 1,
	});
	rawPath.addTo(map);

	let cleanTailsJson = {
		cleanedUp: 0,
		distKm: allPoints[allPoints.length - 1].cumulativeDistanceKm,
		newPath: allPoints,
	};

	//Call a cleaning function until the result stabilizes
	let keepGoing = true;
	if (hasRouteLink) {
		keepGoing = false;
		hasRouteLink = false; //Reset this so that from now on it will perform the route cleaning
	}
	let countCalcs = 0;
	let waypoints = [];
	for (const waypoint of initialWaypoints) waypoints.push(waypoint);
	lastCounts = { cleaned: -1, total: -1 };
	while (keepGoing) {
		countCalcs += 1;

		//Take allPoints and clean up the path.
		cleanTailsJson = await fetchFromServer("cleanTails", { LLs: allPoints });

		if (cleanTailsJson.cleanedUp > 0) {
			//You modified the path, so redo the whole thing with this modified path.
			//Generate the new set of allPoints.
			allPoints.length = 0;
			for (const point of cleanTailsJson.newPath) allPoints.push(point);

			//Based on the new allPoints, find the current set of waypoints.  Choose the closest points to the previous waypoints.
			newWaypoints = [];
			for (const waypoint of waypoints) {
				let closest = null;
				for (const point of allPoints) {
					const separation =
						Math.pow(waypoint.lat - point.lat, 2) +
						Math.pow(waypoint.lng - point.lng, 2);
					if (closest == null)
						closest = { point: point, separation: separation };
					if (separation < closest.separation)
						closest = { point: point, separation: separation };
				}
				newWaypoints.push(closest.point);
			}
			waypoints = newWaypoints;

			const directionsJson = await getDirections(waypoints);
			allPoints = directionsJson.features[0].allPoints;
		} else {
			//No change, so that's it.
			keepGoing = false;
		}

		if (
			cleanTailsJson.cleanedUp === lastCounts.cleaned &&
			allPoints.length === lastCounts.total
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

	const distDisplay = cleanTailsJson.distKm;
	document.getElementById("outDist").innerHTML = distDisplay.toFixed(1);
	document.getElementById("calcs").innerHTML = countCalcs;

	rlPath = new L.Polyline(
		allPoints.map(point => new L.LatLng(point.lat, point.lng)),
		{
			color: "red",
			weight: 3,
			opacity: 1.0,
			smoothFactor: 1,
		});
	rlPath.addTo(map);

	map.removeLayer(rawPath);
	map.removeLayer(guidepointPath);

	currentWaypoints = JSON.parse(JSON.stringify(waypoints));

	return;
};

//........................................................................................
async function doRL(waypointsIn) {
	cleanMap();
	const initialWaypoints = waypointsIn ?? (await getRLpoints());
	drawGuidePoints(initialWaypoints, waypointsIn);

	const theJson = await getDirections(initialWaypoints);

	if ("error" in theJson) {
		alert(
			`The routing server has returned an error.  Try again with a slightly shorter route.  The error returned was "${theJson.error}"`,
		);
		cleanMap();
		return;
	} else {
		improveDirections(theJson.features[0].allPoints, initialWaypoints);
	}
}

const fetchFromServer = async (path, data) => {
	const ApiHeaders = {
		Accept: "application/json",
		"Content-Type": "application/json",
	};
	const theResp = await fetch(`${protocol}//${hostname}:${port}/${path}`, {
		method: "POST",
		body: JSON.stringify(data),
		headers: ApiHeaders,
	});
	return theResp.json();
};

const promptForSpeed = (mode, paceDefault, pace) => {
	let speed = prompt(`Your average ${mode} speed in ${pace}.`, paceDefault);
	if (pace.indexOf("minutes-per") >= 0) speed = 60 / speed;
	return speed;
};

//......................................................................................................
async function generateOutput() {
	const theType = document.getElementById("createOutput").value;
	if (theType === "none") return;

	const routeName = document.getElementById("routeName").value.trim();
	const units = document.getElementById("inputUnits").value;
	const mode = document.getElementById("inputMode").value;
	const advanceUnits = "meters";
	let pace = "kph";
	let paceDefault = 25;
	if (mode === "walking") {
		pace = "minutes-per-kilometer";
		paceDefault = 6; //min per km
	}

	let theJson;
	let doPrint = false;
	let doShow = false;

	if (theType === "directions") {
		theJson = await fetchFromServer("showDirections", {
			allPoints: allPoints,
			units: units,
			speed: promptForSpeed(mode, paceDefault, pace),
		});
		doPrint = confirm("Print it?");
		doShow = true;
	}

	if (theType === "sparseGPX") {
		theJson = await fetchFromServer("makeSparseGPX", { allPoints: allPoints });
		doPrint = true;
	}

	if (theType === "denseGPX") {
		theJson = await fetchFromServer("makeDenseGPX", {
			allPoints: allPoints,
			units: units,
			speed: promptForSpeed(mode, paceDefault, pace),
		});
		doPrint = true;
	}

	if (theType === "tcx") {
		const speed = promptForSpeed(mode, paceDefault, pace);
		const advance = prompt(
			`Set turn warnings this many ${advanceUnits} in advance.`,
			300,
		);

		theJson = await fetchFromServer("makeTCX", {
			allPoints: allPoints,
			units: units,
			speed: speed,
			advance: advance,
			name: routeName,
		});
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
		theJson = { status: "google" };
	}

	if (theType === "link") {
		saveConfiguration();
		doPrint = false;
		theJson = { status: "link" };
	}

	if (theJson.status === "OK") {
		let theInfo = "";
		let theType = "";
		if ("html" in theJson) {
			theInfo = theJson.html;
			theType = "html";
		}
		if ("gpx" in theJson) {
			theInfo = theJson.gpx;
			theType = "gpx";
		}
		if ("tcx" in theJson) {
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
	const theConfiguration = {
		inputLocation: homeLocation,
		inputDist: document.getElementById("inputDist").value,
		inputUnits: document.getElementById("inputUnits").value,
		inputMode: document.getElementById("inputMode").value,
		fitnessLevel: document.getElementById("fitnessLevel").value,
		greenFactor: document.getElementById("greenFactor").value,
		quietFactor: document.getElementById("quietFactor").value,
		inputRotation: document.getElementById("inputRotation").value,
		inputDirection: direction,
		method: method,
		inputHighways: document.getElementById("inputHighways").value,
		inputFerries: avoidFerries,
		currentWaypoints: currentWaypoints,
	};

	let theLink = "";
	theLink = `${protocol}//${hostname}:${port}/index.html`;
	theLink += "?routeLink=true";
	for (const item in theConfiguration) {
		if (item !== "currentWaypoints")
			theLink += `&${item}=${theConfiguration[item]}`;
	}
	if (currentWaypoints.length > 0) {
		let text = "";
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
		let useMode = "cycling-road";
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
	const waypoints = [];
	let pts = [];
	if (urlParams.has("waypoints")) {
		pts = urlParams.get("waypoints");
		pts = pts.split("|");
		for (const item of pts) {
			const pair = item.split(",");
			waypoints.push({ lat: pair[0], lng: pair[1] });
		}
	}

	doRL(waypoints);

	return;
}
