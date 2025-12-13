import { circleRoute } from "./routes/circle.js";
import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LNG_EQUATOR,
	METERS_PER_KILOMETER,
} from "./routes/constants.js";

// Extracted without refactor from serverCodeOsm.js
// Provides getRLpoints, circleRoute, rectangleRoute, fig8Route
// Named constants to eliminate magic numbers and clarify intent

// Distance conversion

// Circle/figure-8 generation parameters
const FIG8_CIRCLE_POINTS = 3; // points per lobe in figure-8

// Rectangle generation parameters
const RECT_MAX_RATIO = 5; // max height:width ratio
const RECT_MIN_RATIO = 1 / RECT_MAX_RATIO; // min height:width ratio

// Heading sectors (radians) relative to east=0 using original fractional definitions
// Note: Precomputed angle fractions kept for clarity but not directly used

export const parseQuery = (url) => {
	const params = new URLSearchParams(url.split("?")[1]);
	return {
		latLng: { lat: +params.get("lat"), lng: +params.get("lng") },
		dist: params.get("dist") * METERS_PER_KILOMETER,
		direction: params.get("direction") ? +params.get("direction") : 0,
		method: calculateMethod(params.get("method")),
		rotation: params.get("rotation") ?? "clockwise",
	};
};

const calculateMethod = (maybeMethod) => {
	if (maybeMethod && maybeMethod !== "random") return maybeMethod;
	return ["circular", "rectangular", "figure8"][
		Math.floor(Math.random() * methods.length)
	];
};

const methods = {
	circular: circleRoute,
	rectangular: rectangleRoute,
	figure8: fig8Route,
};

/**
 * Retrieves route loop points based on the specified parameters.
 *
 * @async
 * @function getRLpoints
 * @param {Object} params - The parameters for generating route loop points.
 * @param {Object} params.latLng - The latitude and longitude coordinates.
 * @param {number} params.dist - The distance for the route loop in meters.
 * @param {string} params.direction - The direction of the route loop.
 * @param {string} params.method - The method to use for generating points.
 * @param {number} params.rotation - The rotation angle for the route loop.
 * @returns {Promise<any>} A promise that resolves to the generated route loop points.
 */
export async function getRLpoints({
	latLng,
	dist,
	direction,
	method,
	rotation,
}) {
	return methods[method](latLng, dist, direction, rotation);
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

	const th2 = travelHeading;
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
	const th3 = travelHeading;
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
