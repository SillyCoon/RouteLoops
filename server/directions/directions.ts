import type { MultiPoint } from "geojson";
import { OpenRouteService } from "../openroute/index.js";
import { buildCoordinates, buildOptions, type Query } from "./query.js";

// Shared helper to compute distance between two lat/lng points in km.
export function LatLngDist(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
) {
	const R = 6371; // km
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

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

export async function directions(params: Query): Promise<
	{
		lat: number;
		lng: number;
		instructions?: string | undefined;
		cumulativeDistanceKm?: number | undefined;
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
			({ lat, lng }) as {
				lat: number;
				lng: number;
				instructions?: string;
				cumulativeDistanceKm?: number;
				distanceToNextKm?: number;
				nextInstructionAt?: number;
			},
	);
	for (let a = allPoints.length - 1; a >= 1; a--) {
		if (
			allPoints?.[a]?.lat === allPoints?.[a - 1]?.lat &&
			allPoints?.[a]?.lng === allPoints?.[a - 1]?.lng
		) {
			allPoints.splice(a, 1);
		}
	}
	let cumulativeDistance = 0;
	const firstPoint = allPoints[0];
	if (firstPoint) firstPoint.cumulativeDistanceKm = 0;

	for (let a = 1; a < allPoints.length; a++) {
		const prev = allPoints[a - 1];
		const curr = allPoints[a];
		cumulativeDistance +=
			prev && curr ? LatLngDist(prev.lat, prev.lng, curr.lat, curr.lng) : 0;
		const point = allPoints[a];
		if (point) point.cumulativeDistanceKm = cumulativeDistance;
	}

	for (const segment of feature.properties?.segments ?? []) {
		for (const step of segment.steps ?? []) {
			const atPoint = step.way_points[0];
			const instructions = step.instruction;
			const point = allPoints[atPoint];
			try {
				if (point) point.instructions = instructions;
			} catch {
				// ignore
			}
		}
	}
	for (let a = 0; a < allPoints.length; a++) {
		const point = allPoints[a];
		if (!point || !("instructions" in point)) continue;
		let distanceToNext = 0;
		let b: number;
		for (b = a + 1; b < allPoints.length; b++) {
			const prev = allPoints[b - 1];
			const curr = allPoints[b];
			distanceToNext +=
				prev && curr ? LatLngDist(prev.lat, prev.lng, curr.lat, curr.lng) : 0;
			if (curr && "instructions" in curr) break;
		}
		point.distanceToNextKm = distanceToNext;
		point.nextInstructionAt = b;
		a = b - 1;
	}

	return allPoints;
}
