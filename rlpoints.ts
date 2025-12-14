import { circleRoute } from "./routes/circle.js";
import { rectangleRoute } from "./routes/rectangle.js";
import { fig8Route } from "./routes/fig8.js";
import { METERS_PER_KILOMETER } from "./routes/constants.js";
import * as v from "valibot";

const schema = v.object({
	lat: v.pipe(
		v.string(),
		v.transform((str) => Number.parseFloat(str)),
	),
	lng: v.pipe(
		v.string(),
		v.transform((str) => Number.parseFloat(str)),
	),
	dist: v.pipe(
		v.string(),
		v.transform((str) => Number.parseFloat(str)),
	),
	direction: v.optional(
		v.pipe(
			v.string(),
			v.transform((str) => Number.parseInt(str, 10)),
		),
	),
	method: v.optional(
		v.picklist(["random", "circular", "rectangular", "figure8"]),
	),
	rotation: v.optional(v.string()),
});

export const parseQuery = (params: URLSearchParams) => {
	const parsed = v.parse(schema, {
		lat: params.get("lat"),
		lng: params.get("lng"),
		dist: params.get("dist"),
		direction: params.get("direction"),
		method: params.get("method"),
		rotation: params.get("rotation"),
	});
	return {
		latLng: { lat: parsed.lat, lng: parsed.lng },
		dist: parsed.dist * METERS_PER_KILOMETER,
		direction: parsed.direction ?? 0,
		method: calculateMethod(parsed.method ?? "random"),
		rotation: parsed.rotation ?? "clockwise",
	};
};

type Query = ReturnType<typeof parseQuery>;

const calculateMethod = (
	maybeMethod: "random" | "circular" | "rectangular" | "figure8",
): "circular" | "rectangular" | "figure8" => {
	if (maybeMethod && maybeMethod !== "random") return maybeMethod;
	const methods = ["circular", "rectangular", "figure8"] as const;
	return methods[Math.floor(Math.random() * methods.length)] ?? "circular";
};

const methods = {
	circular: circleRoute,
	rectangular: rectangleRoute,
	figure8: fig8Route,
};

export async function getRLpoints({
	latLng,
	dist,
	direction,
	method,
	rotation,
}: Query) {
	return methods[method](latLng, dist, direction, rotation);
}
