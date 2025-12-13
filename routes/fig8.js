import {
	calculatePoint,
	directionByHeading,
	signByRotation,
} from "./constants";

const FIG8_CIRCLE_POINTS = 3; // points per lobe in figure-8

// TODO: use circleRoute as helper
const calculateCirclePoints = (location, direction, radius, rotation) => {
	const deg = [];
	const rlPoints = [];
	const center = calculatePoint(location, direction, radius);

	deg.push(direction + Math.PI);
	const sign = signByRotation[rotation];

	for (let i = 1; i < FIG8_CIRCLE_POINTS + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (FIG8_CIRCLE_POINTS + 1));
		rlPoints.push(calculatePoint(center, deg[i], radius));
	}
	return rlPoints;
};

export function fig8Route(BaseLocation, length, travelHeading, rotation) {
	const radius = length / (4 * Math.PI);

	const direction =
		directionByHeading[travelHeading] ?? directionByHeading.default;

	const firstCircle = calculateCirclePoints(
		BaseLocation,
		direction,
		radius,
		rotation,
	);
	const secondCircle = calculateCirclePoints(
		BaseLocation,
		direction + Math.PI,
		radius,
		rotation === "clockwise" ? "counterclockwise" : "clockwise",
	);

	return [...firstCircle, ...secondCircle];
}
