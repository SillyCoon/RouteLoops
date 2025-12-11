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
	} catch {}

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

const getRLParams = () => {
	return new URLSearchParams([
		["lat", homeLocation.lat],
		["lng", homeLocation.lng],
		["dist", document.getElementById("inputDist").value],
		["units", document.getElementById("inputUnits").value],
		["rotation", document.getElementById("inputRotation").value],
		["direction", direction],
		["method", method],
	]);
};

const getRLpoints = async () => {
	const theResp = await fetch(url(`getRLpoints`, getRLParams()));
	return theResp.json();
};

const drawGuidePoints = (waypoints, waypointsIn) => {
	//Add the starting location as both the first, and the last, guide point.
	const guidePoints = [
		new L.LatLng(homeLocation.lat, homeLocation.lng),
		...waypoints.map((wp) => new L.LatLng(wp.lat, wp.lng)),
		new L.LatLng(homeLocation.lat, homeLocation.lng),
	];
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

const drawRawPath = (points) => {
	rawPath = new L.Polyline(
		points.map((point) => new L.LatLng(point.lat, point.lng)),
		{
			color: "green",
			weight: 2,
			opacity: 1.0,
			smoothFactor: 1,
		},
	);
	rawPath.addTo(map);
};

const drawFinalPath = (data) => {
	rlPath && map.removeLayer(rlPath);

	document.getElementById("outDist").innerHTML = data.distance.toFixed(1);
	document.getElementById("calcs").innerHTML = data.countCalcs;

	rlPath = new L.Polyline(
		data.points.map((point) => new L.LatLng(point.lat, point.lng)),
		{
			color: "red",
			weight: 3,
			opacity: 1.0,
			smoothFactor: 1,
		},
	);
	rlPath.addTo(map);

	currentWaypoints = JSON.parse(JSON.stringify(data.waypoints));
};

const getDirectionsParams = (initialWaypoints) => {
	return new URLSearchParams([
		["distance", document.getElementById("inputDist").value],
		["lat", homeLocation.lat],
		["lng", homeLocation.lng],
		["mode", document.getElementById("inputMode").value],
		["highways", document.getElementById("inputHighways").value],
		["ferries", avoidFerries],
		["fitnessLevel", document.getElementById("fitnessLevel").value],
		["greenFactor", document.getElementById("greenFactor").value],
		["quietFactor", document.getElementById("quietFactor").value],
		[
			"waypoints",
			initialWaypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|"),
		],
	]);
};

const url = (path, params) => {
	return `${protocol}//${hostname}:${port}/${path}?${params.toString()}`;
};

const getCleanDirections = async (initialWaypoints) => {
	const params = getDirectionsParams(initialWaypoints);

	const evtSource = new EventSource(url(`cleanDirections`, params));

	evtSource.addEventListener("start", (event) => {
		const data = JSON.parse(event.data);
		drawRawPath(data.points);
		rlPath = null;
	});

	evtSource.addEventListener("refinement", (event) => {
		const data = JSON.parse(event.data);

		if (data.iteration === 1) {
			map.removeLayer(rawPath);
			map.removeLayer(guidepointPath);
		}
		drawFinalPath(data);

		currentWaypoints = JSON.parse(JSON.stringify(data.waypoints));
	});
};

const cleanMap = () => {
	//Clear any paths on the map if there are any.
	try {
		map.removeLayer(rlPath);
	} catch {}
	try {
		map.removeLayer(rawPath);
	} catch {}
	try {
		map.removeLayer(guidepointPath);
	} catch {}
	try {
		homeMarker.remove();
	} catch {}
};

//........................................................................................
async function doRL(waypointsIn) {
	cleanMap();
	const initialWaypoints = waypointsIn ?? (await getRLpoints());
	drawGuidePoints(initialWaypoints, waypointsIn);

	await getCleanDirections(initialWaypoints);
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
