import {
	directionByHeading,
	signByRotation,
	calculatePoint,
} from "./constants";

const RECT_MAX_RATIO = 5; // max height:width ratio
const RECT_MIN_RATIO = 1 / RECT_MAX_RATIO; // min height:width ratio
const DELTA_RATIO = RECT_MAX_RATIO - RECT_MIN_RATIO;

const calculateSquareMeasurements = (length) => {
	const ratio = Math.random() * DELTA_RATIO + RECT_MIN_RATIO;
	const width = length / (2 * ratio + 2);
	const height = width * ratio;
	const diagonal = Math.sqrt(width * width + height * height);
	const theta = Math.acos(height / diagonal);

	return {
		width,
		height,
		diagonal,
		theta,
	};
};

export function rectangleRoute(BaseLocation, length, travelHeading, rotation) {
	const { width, height, diagonal, theta } =
		calculateSquareMeasurements(length);

	const direction =
		directionByHeading[travelHeading] ?? directionByHeading.default;

	const sign = signByRotation[rotation];

	return [
		calculatePoint(BaseLocation, direction, height),
		calculatePoint(BaseLocation, sign * theta + direction, diagonal),
		calculatePoint(BaseLocation, (sign * Math.PI) / 2 + direction, width),
	];
}
