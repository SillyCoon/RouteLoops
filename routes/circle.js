import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LNG_EQUATOR,
} from "./constants.js";

const DEFAULT_CIRCLE_POINTS = 4; // points around circle for circular route

const calculatePoint = (location, direction, radius) => {
	const dx = radius * Math.cos(direction);
	const dy = radius * Math.sin(direction);
	const delta_lat = dy / METERS_PER_DEGREE_LAT;
	const delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((location.lat * Math.PI) / 180));
	return {
		lat: location.lat + delta_lat,
		lng: location.lng + delta_lng,
	};
};

const directionByHeading = {
	0: Math.random() * Math.PI * 2,
	1: (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8,
	2: (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8,
	3: (Math.random() * Math.PI) / 4 - Math.PI / 8,
	4: (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8,
	5: (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8,
	6: (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8,
	7: (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8,
	8: (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8,
	default: Math.random() * Math.PI * 2,
};

export function circleRoute(BaseLocation, length, travelHeading, rotation) {
	const sign = rotation === "clockwise" ? -1 : 1;
	const radius = length / (2 * Math.PI);
	const circlePoints = DEFAULT_CIRCLE_POINTS;
	const deg = [];
	const rlPoints = [];
	const direction =
		directionByHeading[travelHeading] ?? directionByHeading.default;
	const center = calculatePoint(BaseLocation, direction, radius);

	deg.push(direction + Math.PI);

	for (let i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		rlPoints.push(calculatePoint(center, deg[i], radius));
	}

	return rlPoints;
}
