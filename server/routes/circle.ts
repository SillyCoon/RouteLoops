import {
	METERS_PER_DEGREE_LAT,
	METERS_PER_DEGREE_LNG_EQUATOR,
	directionByHeading,
	signByRotation,
} from "./constants";

const DEFAULT_CIRCLE_POINTS = 4; // points around circle for circular route

const calculatePoint = (
	location: { lat: number; lng: number },
	direction: number,
	radius: number,
) => {
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
	BaseLocation: { lat: number; lng: number },
	length: number,
	travelHeading: number,
	rotation: "clockwise" | "counterclockwise",
	circlePoints = DEFAULT_CIRCLE_POINTS,
	directionOverride?: number,
): { lat: number; lng: number }[] {
	const sign = signByRotation[rotation];
	const radius = length / (2 * Math.PI);
	const rlPoints: { lat: number; lng: number }[] = [];
	const direction =
		directionOverride ??
		directionByHeading[travelHeading] ??
		directionByHeading.default;
	const center = calculatePoint(BaseLocation, direction, radius);

	const startAngle = direction + Math.PI;
	const stepAngle = (sign * 2 * Math.PI) / (circlePoints + 1);
	for (let i = 1; i <= circlePoints; i++) {
		const angle = startAngle + stepAngle * i;
		rlPoints.push(calculatePoint(center, angle, radius));
	}

	return rlPoints;
}
