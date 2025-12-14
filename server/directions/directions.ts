import { buildCoordinates, buildOptions, type Query } from "./query.js";

// Shared helper to compute distance between two lat/lng points in km.
function LatLngDist(lat1: number, lon1: number, lat2: number, lon2: number) {
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

type Response = {
	error?: { code: number; message: string };
	features: Array<{
		geometry: { coordinates: Array<[number, number]> };
		properties: {
			segments: Array<{
				steps: Array<{
					instruction: string;
					way_points: [number, number];
				}>;
			}>;
		};
		totalDistanceKm?: number;
		allPoints?: Array<{
			lat: number;
			lng: number;
			cumulativeDistanceKm?: number;
			instructions?: string;
			distanceToNextKm?: number;
			nextInstructionAt?: number;
		}>;
	}>;
};

const fetchDirections = async (
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
): Promise<Response | null> => {
	const apiRoot = `https://api.openrouteservice.org/v2/directions/${mode}/geojson`;
	if (!process.env.OSM_API_KEY) {
		throw new Error("OSM_API_KEY environment variable is not set.");
	}
	try {
		const response = await fetch(apiRoot, {
			method: "POST",
			body: JSON.stringify(data),
			headers: {
				Accept:
					"application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
				Authorization: process.env.OSM_API_KEY,
				"Content-Type": "application/json; charset=utf-8",
			},
		});
		return response.json() as Promise<Response>;
	} catch (error) {
		console.log("Error in fetchDirections:", error);
		return null;
	}
};

async function directions(params: Query) {
	let theJson: Response | null = null;

	console.log("Doing a directions GET call:");

	const coordinates = buildCoordinates(params);
	const options = buildOptions(params);

	let tryAgain = true;
	let directionsError = null;
	while (tryAgain) {
		const data = { coordinates, options };

		theJson = await fetchDirections(params.mode, data);

		if (theJson && "error" in theJson && theJson.error) {
			console.log("Directions error:", theJson);
			if (theJson.error.message.indexOf("Could not find routable point") >= 0) {
				const split = theJson.error.message.split("coordinate");
				const info = split[1]?.trim() ?? "";
				const split2 = info.split(":");
				const badCoord = split2[0];
				const badLL = split2[1]?.trim() ?? "";
				const split3 = badLL.split(" ");
				const badLatLng = { lat: split3[0], lng: split3[1] };
				console.log(
					`Coordinate ${badCoord} at ${JSON.stringify(badLatLng)} is bad, so try again without it.`,
				);
				badCoord && coordinates.splice(+badCoord, 1);
				tryAgain = true;
			} else if (theJson.error.message.indexOf("150000") >= 0) {
				directionsError = theJson.error.message;
				tryAgain = false;
			}
		} else {
			tryAgain = false;
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	if (directionsError == null && theJson) {
		for (const feature of theJson.features) {
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
			feature.totalDistanceKm = cumulativeDistance;
			for (const segment of feature.properties.segments ?? []) {
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
						prev && curr
							? LatLngDist(prev.lat, prev.lng, curr.lat, curr.lng)
							: 0;
					if (curr && "instructions" in curr) break;
				}
				point.distanceToNextKm = distanceToNext;
				point.nextInstructionAt = b;
				a = b - 1;
			}

			feature.allPoints = allPoints;
		}

		return theJson;
	} else {
		return { status: "NG", error: directionsError };
	}
}

export { directions, LatLngDist };
