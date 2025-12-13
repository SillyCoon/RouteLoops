import { directionByHeading } from "./constants.js";
import { circleRoute } from "./circle.js";

const FIG8_CIRCLE_POINTS = 3; // points per lobe in figure-8

export function fig8Route(BaseLocation, length, travelHeading, rotation) {
	const direction =
		directionByHeading[travelHeading] ?? directionByHeading.default;

	// Each lobe uses half the total length to keep radius consistent
	const firstCircle = circleRoute(
		BaseLocation,
		length / 2,
		travelHeading,
		rotation,
		FIG8_CIRCLE_POINTS,
		direction,
	);
	const secondCircle = circleRoute(
		BaseLocation,
		length / 2,
		travelHeading,
		rotation === "clockwise" ? "counterclockwise" : "clockwise",
		FIG8_CIRCLE_POINTS,
		direction + Math.PI,
	);

	return [...firstCircle, ...secondCircle];
}
