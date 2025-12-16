import type { MultiPoint } from "geojson";
import type { FetchDirections } from "../directions/directions";

type OpenRouteError = {
	error: true;
	code: number;
	message: string;
};
export const isOpenRouteError = (
	response: GeoJSON.FeatureCollection<MultiPoint> | OpenRouteError,
): response is OpenRouteError => {
	return (response as OpenRouteError).error === true;
};

const removeBadCoordinates = (
	coordinates: [number, number][],
	message: string,
) => {
	const split = message.split("coordinate");
	const info = split[1]?.trim() ?? "";
	const split2 = info.split(":");
	const badLL = split2[1]?.trim() ?? "";
	const split3 = badLL.split(" ");
	const badLatLng = { lat: split3[0], lng: split3[1] };

	const badCoord = split2[0] ? Number.parseInt(split2[0], 10) : null;
	console.log(
		`Coordinate ${badCoord} at ${JSON.stringify(badLatLng)} is bad, so try again without it.`,
	);

	return badCoord !== null ? coordinates.toSpliced(badCoord, 1) : coordinates;
};

const fetchRawDirections = async (
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
): Promise<GeoJSON.FeatureCollection<MultiPoint> | OpenRouteError | null> => {
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

		if (response.status === 404) {
			return response.json() as Promise<OpenRouteError>;
		}

		if (!response.ok) {
			console.log(
				"Error response from OpenRouteService:",
				response.status,
				await response.text(),
			);
			return null;
		}

		return response.json() as Promise<GeoJSON.FeatureCollection<MultiPoint>>;
	} catch (error) {
		console.log("Error in fetchDirections:", error);
		return null;
	}
};

const BAD_COORDINATE_CODE = 2063;
export const fetchDirections: FetchDirections = async (mode, data) => {
	const response = await fetchRawDirections(mode, data);
	if (response === null) {
		return null;
	}

	const isBadCoordinateError =
		isOpenRouteError(response) && response.code === BAD_COORDINATE_CODE;

	if (isBadCoordinateError) {
		const cleanedCoordinates = removeBadCoordinates(
			data.coordinates,
			response.message,
		);
		return fetchDirections(mode, {
			...data,
			coordinates: cleanedCoordinates,
		});
	}

	if (isOpenRouteError(response)) {
		console.log(
			"OpenRouteService returned an error:",
			response.code,
			response.message,
		);
		return null;
	}

	return response.features[0] ?? null;
};

export const OpenRouteService = { fetchDirections };
