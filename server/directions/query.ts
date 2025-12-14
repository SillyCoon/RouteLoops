// Helpers
export function parseQuery(params: URLSearchParams | undefined): {
	lat: number | null;
	lng: number | null;
	highways: boolean;
	ferries: boolean;
	waypoints: (readonly [number, number])[];
	mode: string;
	fitnessLevel: number;
	greenFactor: number;
	quietFactor: number;
	distance: number;
} {
	const defaults = {
		lat: null,
		lng: null,
		highways: false,
		ferries: false,
		waypoints: [],
		mode: "cycling-regular",
		fitnessLevel: 1,
		greenFactor: 0,
		quietFactor: 0,
		distance: 0,
	};
	if (!params) return defaults;
	const latRaw = params.get("lat");
	const lngRaw = params.get("lng");
	const latParsed = latRaw != null ? Number(latRaw) : null;
	const lngParsed = lngRaw != null ? Number(lngRaw) : null;
	const lat =
		latParsed != null && Number.isFinite(latParsed) ? latParsed : null;
	const lng =
		lngParsed != null && Number.isFinite(lngParsed) ? lngParsed : null;
	const waypoints = params.get("waypoints");
	const waypointsArray = (waypoints ?? "")
		.split("|")
		.map((wp) => wp.split(","))
		.filter((parts) => parts.length === 2)
		.map(([lat, lng]) => {
			return [Number(lng), Number(lat)] as const;
		})
		.filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng));

	const fitnessLevel = Number(params.get("fitnessLevel") ?? 1);
	const greenFactor = Number(params.get("greenFactor") ?? 0);
	const quietFactor = Number(params.get("quietFactor") ?? 0);
	const distance = Number(params.get("distance") ?? 0);

	return {
		lat,
		lng,
		highways: params.get("highways") === "yes",
		ferries: params.get("ferries") === "yes",
		waypoints: waypointsArray,
		mode: params.get("mode") ?? "cycling-regular",
		fitnessLevel: Number.isFinite(fitnessLevel)
			? fitnessLevel
			: defaults.fitnessLevel,
		greenFactor: Number.isFinite(greenFactor)
			? greenFactor
			: defaults.greenFactor,
		quietFactor: Number.isFinite(quietFactor)
			? quietFactor
			: defaults.quietFactor,
		distance: Number.isFinite(distance) ? distance : defaults.distance,
	};
}

export type Query = ReturnType<typeof parseQuery>;

export function buildCoordinates(result: Query): [number, number][] {
	const start: [number, number][] =
		result.lng != null && result.lat != null ? [[result.lng, result.lat]] : [];
	const end: [number, number][] =
		result.lng != null && result.lat != null ? [[result.lng, result.lat]] : [];
	return [...start, ...(result.waypoints as [number, number][]), ...end];
}

export function buildOptions({ mode, highways, ...result }: Query) {
	const isDriving = mode.includes("driv");
	const isCycling = mode.includes("cycl");
	const isFoot = mode.includes("foot");
	const avoid_features = [];
	const tolls = highways;
	if (isDriving && tolls) avoid_features.push("tollways");
	if ((isDriving || isCycling || isFoot) && result.ferries)
		avoid_features.push("ferries");
	if (isDriving && highways) avoid_features.push("highways");

	return {
		avoid_features,
		profile_params: {
			weightings: {
				steepness_difficulty: result.fitnessLevel,
				green: result.greenFactor,
				quiet: result.quietFactor,
			},
		},
	};
}
