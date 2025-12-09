// Extracted without refactor from serverCodeOsm.js
// Provides getRLpoints, circleRoute, rectangleRoute, fig8Route
// Named constants to eliminate magic numbers and clarify intent

// Distance conversion
const INCHES_PER_FOOT = 12;
const CENTIMETERS_PER_INCH = 2.54;
const METERS_PER_CENTIMETER = 0.01;
const FEET_PER_MILE = 5280;
const METERS_PER_KILOMETER = 1000;

// Geographic approximations
// Mean meters per degree latitude (approx.)
const METERS_PER_DEGREE_LAT = 110540;
// Mean meters per degree longitude at equator; scaled by cos(latitude)
const METERS_PER_DEGREE_LNG_EQUATOR = 111320;

// Circle/figure-8 generation parameters
const DEFAULT_CIRCLE_POINTS = 4; // points around circle for circular route
const FIG8_CIRCLE_POINTS = 3; // points per lobe in figure-8

// Rectangle generation parameters
const RECT_MAX_RATIO = 5; // max height:width ratio
const RECT_MIN_RATIO = 1 / RECT_MAX_RATIO; // min height:width ratio

// Heading sectors (radians) relative to east=0 using original fractional definitions
// Note: Precomputed angle fractions kept for clarity but not directly used

export async function getRLpoints(req, res) {
	const method = req.method;
	const url = req.url;
	if (method.toLowerCase() === "get") {
		const qsIndex = url.indexOf("?");
		const search = qsIndex >= 0 ? url.slice(qsIndex + 1) : "";
		const params = new URLSearchParams(search);
		const result = {
			lat: params.get("lat"),
			lng: params.get("lng"),
			dist: params.get("dist"),
			units: params.get("units"),
			method: params.get("method"),
			direction: params.get("direction"),
			rotation: params.get("rotation"),
		};

		const LatLng = { lat: 1 * result.lat, lng: 1 * result.lng };

		let targetLengthInMeters = result.dist;

		let units = result.units;
		if (units == null) units = "imperial";
		// Imperial: miles->feet->inches->cm->meters
		if (units === "imperial") {
			const INCHES_PER_MILE = FEET_PER_MILE * INCHES_PER_FOOT;
			const METERS_PER_MILE =
				INCHES_PER_MILE * CENTIMETERS_PER_INCH * METERS_PER_CENTIMETER;
			targetLengthInMeters *= METERS_PER_MILE;
		}
		if (units === "metric") targetLengthInMeters *= METERS_PER_KILOMETER;

		let direction = result.direction;
		if (direction == null) direction = 0;

		let rotation = result.rotation;
		if (rotation == null) rotation = "clockwise";

		let pickMethod = result.method;

		if (pickMethod === "random" || pickMethod == null) {
			const methods = ["circular", "rectangular", "figure8"];
			pickMethod = methods[Math.floor(Math.random() * methods.length)];
		}

		console.log(`picMethod of ${pickMethod} in direction ${direction} `);
		let rlPoints = [];
		if (pickMethod === "circular")
			rlPoints = circleRoute(LatLng, targetLengthInMeters, direction, rotation);
		if (pickMethod === "rectangular")
			rlPoints = rectangleRoute(
				LatLng,
				targetLengthInMeters,
				direction,
				rotation,
			);
		if (pickMethod === "figure8")
			rlPoints = fig8Route(LatLng, targetLengthInMeters, direction, rotation);

		res.json(rlPoints);
	} else if (method.toLowerCase() === "post") {
	}
}

function circleRoute(BaseLocation, length, travelHeading, rotation) {
	const radius = length / (2 * Math.PI);
	const circlePoints = DEFAULT_CIRCLE_POINTS;
	const deg = [];
	const rlPoints = [];

	let direction = Math.random() * 2 * Math.PI; //in radians
	const th1 = Number(travelHeading);
	if (th1 === 0)
		direction = Math.random() * 2 * Math.PI; //in radians
	else if (th1 === 1)
		direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (th1 === 2)
		direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (th1 === 3) direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (th1 === 4)
		direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (th1 === 5)
		direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (th1 === 6)
		direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (th1 === 7)
		direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (th1 === 8)
		direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	let dx = radius * Math.cos(direction);
	let dy = radius * Math.sin(direction);
	let delta_lat = dy / METERS_PER_DEGREE_LAT;
	let delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	const center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.push(direction + Math.PI);
	let sign = -1;
	if (rotation === "clockwise") sign = -1;
	else sign = +1;

	for (let i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / METERS_PER_DEGREE_LAT;
		delta_lng =
			dx /
			(METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
	}

	return rlPoints;
}

function rectangleRoute(BaseLocation, length, travelHeading, rotation) {
	let direction = 0;
	let angle = 0;
	const rlPoints = [];

	const maxRatio = RECT_MAX_RATIO; // explanatory alias
	const minRatio = RECT_MIN_RATIO; // explanatory alias
	const deltaRatio = maxRatio - minRatio;
	const ratio = Math.random() * deltaRatio + minRatio;
	const width = length / (2 * ratio + 2);
	const height = width * ratio;
	const diagonal = Math.sqrt(width * width + height * height);
	const theta = Math.acos(height / diagonal);

	const th2 = Number(travelHeading);
	if (th2 === 0)
		direction = Math.random() * 2 * Math.PI; //in radians
	else if (th2 === 1)
		direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (th2 === 2)
		direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (th2 === 3) direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (th2 === 4)
		direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (th2 === 5)
		direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (th2 === 6)
		direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (th2 === 7)
		direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (th2 === 8)
		direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	let sign = -1;
	if (rotation === "clockwise") sign = -1;
	else sign = +1;

	angle = 0 + direction; // height direction
	let dx = height * Math.cos(angle);
	let dy = height * Math.sin(angle);
	let delta_lat = dy / METERS_PER_DEGREE_LAT;
	let delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	angle = sign * theta + direction; // diagonal direction
	dx = diagonal * Math.cos(angle);
	dy = diagonal * Math.sin(angle);
	delta_lat = dy / METERS_PER_DEGREE_LAT;
	delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	angle = (sign * Math.PI) / 2 + direction; // width direction
	dx = width * Math.cos(angle);
	dy = width * Math.sin(angle);
	delta_lat = dy / METERS_PER_DEGREE_LAT;
	delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	return rlPoints;
}

function fig8Route(BaseLocation, length, travelHeading, rotation) {
	const radius = length / (4 * Math.PI);
	const circlePoints = FIG8_CIRCLE_POINTS;
	const deg = [];
	const rlPoints = [];

	let direction;
	const th3 = Number(travelHeading);
	if (th3 === 0)
		direction = Math.random() * 2 * Math.PI; //in radians
	else if (th3 === 1)
		direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (th3 === 2)
		direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (th3 === 3) direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (th3 === 4)
		direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (th3 === 5)
		direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (th3 === 6)
		direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (th3 === 7)
		direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (th3 === 8)
		direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	let dx = radius * Math.cos(direction);
	let dy = radius * Math.sin(direction);
	let delta_lat = dy / METERS_PER_DEGREE_LAT;
	let delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	let center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.push(direction + Math.PI);
	let sign = -1;
	if (rotation === "clockwise") sign = -1;
	else sign = +1;

	for (let i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / METERS_PER_DEGREE_LAT;
		delta_lng =
			dx /
			(METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
	}

	direction = direction + Math.PI;

	dx = radius * Math.cos(direction);
	dy = radius * Math.sin(direction);
	delta_lat = dy / METERS_PER_DEGREE_LAT;
	delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR *
			Math.cos((BaseLocation.lat * Math.PI) / 180));
	center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.length = 0;
	deg.push(direction + Math.PI);
	sign = +1;
	if (rotation === "clockwise") sign = +1;
	else sign = -1;

	for (let i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / METERS_PER_DEGREE_LAT;
		delta_lng =
			dx /
			(METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
	}

	return rlPoints;
}
