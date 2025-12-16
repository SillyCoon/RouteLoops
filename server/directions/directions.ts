import type { GeoJsonProperties, MultiPoint } from "geojson";
import { OpenRouteService } from "../openroute/index.js";
import { buildCoordinates, buildOptions, type Query } from "./query.js";
import { LatLngDist } from "./utils.js";

export type DirectionsResponse = GeoJSON.Feature<MultiPoint> | null;

export type FetchDirections = (
	mode: string,
	data: {
		coordinates: [number, number][];
		options: {
			avoid_features: string[];
			profile_params: {
				weightings: {
					steepness_difficulty: number;
					green: number;
					quiet: number;
				};
			};
		};
	},
) => Promise<DirectionsResponse | null>;

const removeDuplicates = (points: { lat: number; lng: number }[]) => {
	const uniquePoints = [...points];
	for (let a = points.length - 1; a >= 1; a--) {
		if (
			uniquePoints?.[a]?.lat === uniquePoints?.[a - 1]?.lat &&
			uniquePoints?.[a]?.lng === uniquePoints?.[a - 1]?.lng
		) {
			uniquePoints.splice(a, 1);
		}
	}
	return uniquePoints;
};

type Point = {
	lat: number;
	lng: number;
};

type FinalPoint = Point & {
	instructions?: string;
	distanceToNextKm?: number;
	nextInstructionAt?: number;
};

const addInstructions = (points: FinalPoint[], props: GeoJsonProperties) => {
	for (const segment of props?.segments ?? []) {
		for (const step of segment.steps ?? []) {
			const atPoint = step.way_points[0];
			const point = points[atPoint];
			if (point) point.instructions = step.instruction;
		}
	}
	return points;
};

const addDistanceToNext = (points: FinalPoint[]) => {
	for (let a = 0; a < points.length; a++) {
		const point = points[a];
		if (!point || !("instructions" in point)) continue;
		let distanceToNext = 0;
		let b: number;
		for (b = a + 1; b < points.length; b++) {
			const prev = points[b - 1];
			const curr = points[b];
			distanceToNext +=
				prev && curr ? LatLngDist(prev.lat, prev.lng, curr.lat, curr.lng) : 0;
			if (curr && "instructions" in curr) break;
		}
		point.distanceToNextKm = distanceToNext;
		point.nextInstructionAt = b;
		a = b - 1;
	}
	return points;
};

export async function directions(params: Query): Promise<
	{
		lat: number;
		lng: number;
		instructions?: string | undefined;
		distanceToNextKm?: number | undefined;
		nextInstructionAt?: number | undefined;
	}[]
> {
	console.log("Doing a directions GET call:");

	const feature = await OpenRouteService.fetchDirections(params.mode, {
		coordinates: buildCoordinates(params),
		options: buildOptions(params),
	});

	if (!feature) return [];

	const allPoints = (feature.geometry.coordinates ?? []).map(
		([lng, lat]) =>
			({
				lat,
				lng,
			}) as Point,
	);
	const uniquePoints = removeDuplicates(allPoints);
	const pointsWithDistanceAndInstructions = addInstructions(
		uniquePoints,
		feature.properties ?? {},
	);
	const finalPoints = addDistanceToNext(pointsWithDistanceAndInstructions);
	return finalPoints;
}
