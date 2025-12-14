import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LNG_EQUATOR,
	directionByHeading,
	signByRotation,
} from "./constants";

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

export function circleRoute(
	BaseLocation,
	length,
	travelHeading,
	rotation,
	circlePoints = DEFAULT_CIRCLE_POINTS,
	directionOverride,
) {
	const sign = signByRotation[rotation];
	const radius = length / (2 * Math.PI);
	const deg = [];
	const rlPoints = [];
	const direction =
		directionOverride ??
		directionByHeading[travelHeading] ??
		directionByHeading.default;
	const center = calculatePoint(BaseLocation, direction, radius);

	deg.push(direction + Math.PI);

	for (let i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		rlPoints.push(calculatePoint(center, deg[i], radius));
	}

	return rlPoints;
}
