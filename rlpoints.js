import { circleRoute } from "./routes/circle.js";
import { rectangleRoute } from "./routes/rectangle.js";
import { fig8Route } from "./routes/fig8.js";
import { METERS_PER_KILOMETER } from "./routes/constants.js";

// Extracted without refactor from serverCodeOsm.js
// Provides getRLpoints, circleRoute, rectangleRoute, fig8Route
// Named constants to eliminate magic numbers and clarify intent

// Distance conversion

// Circle/figure-8 generation parameters

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
