// Shared helper to compute distance between two lat/lng points in km.
function LatLngDist(lat1, lon1, lat2, lon2) {
	const R = 6371; // km
	const toRad = (deg) => (deg * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Helpers
export function parseQuery(url) {
	const defaults = {
		lat: null,
		lng: null,
		highways: "no",
		ferries: "no",
		waypoints: "",
		mode: "cycling-regular",
		fitnessLevel: 1,
		greenFactor: 0,
		quietFactor: 0,
	};
	const qIndex = url.indexOf("?");
	if (qIndex < 0) return defaults;
	const params = new URLSearchParams(url.slice(qIndex + 1));
	const entries = Object.fromEntries(params.entries());
	return { ...defaults, ...entries };
}

export function buildCoordinates(result) {
	const start =
		result.lng != null && result.lat != null ? [[result.lng, result.lat]] : [];
	const waypoints = (result.waypoints ?? "")
		.split("|")
		.map((wp) => wp.split(","))
		.filter((parts) => parts.length === 2)
		.map(([lat, lng]) => [lng, lat])
		.filter(
			([lng, lat]) =>
				Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)),
		);
	const end =
		result.lng != null && result.lat != null ? [[result.lng, result.lat]] : [];
	return [...start, ...waypoints, ...end];
}

export function buildOptions(result) {
	const mode = result.mode ?? "cycling-regular";
	const isDriving = mode.includes("driv");
	const isCycling = mode.includes("cycl");
	const isFoot = mode.includes("foot");
	const avoid_features = [];
	const tolls = result.highways === "yes" ? "yes" : "no";
	if (isDriving && tolls === "yes") avoid_features.push("tollways");
	if ((isDriving || isCycling || isFoot) && result.ferries === "yes")
		avoid_features.push("ferries");
	if (isDriving && result.highways === "yes") avoid_features.push("highways");

	const profile_params = {
		weightings: {
			steepness_difficulty: Number(result.fitnessLevel) * 1,
			green: Number(result.greenFactor) * 1,
			quiet: Number(result.quietFactor) * 1,
		},
	};
	return { avoid_features, profile_params };
}

const fetchDirections = async (mode, data) => {
	const apiRoot = `https://api.openrouteservice.org/v2/directions/${mode}/geojson`;
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
		return response.json();
	} catch (error) {
		console.log("Error in fetchDirections:", error);
		return null;
	}
};

async function directions(result) {
	let theJson = null;

	console.log("Doing a directions GET call:");

	const coordinates = buildCoordinates(result);
	const options = buildOptions(result);

	let tryAgain = true;
	let directionsError = null;
	while (tryAgain) {
		const data = { coordinates, options };

		theJson = await fetchDirections(result.mode, data);
		console.log(JSON.stringify(data));

		if (theJson && "error" in theJson) {
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
				coordinates.splice(badCoord, 1);
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

	if (directionsError == null) {
		for (const feature of theJson.features) {
			const allPoints = (feature.geometry.coordinates ?? []).map(
				([lng, lat]) => ({ lat, lng }),
			);
			for (let a = allPoints.length - 1; a >= 1; a--) {
				if (
					allPoints[a].lat === allPoints[a - 1].lat &&
					allPoints[a].lng === allPoints[a - 1].lng
				) {
					allPoints.splice(a, 1);
				}
			}
			let cumulativeDistance = 0;
			allPoints[0].cumulativeDistanceKm = 0;
			for (let a = 1; a < allPoints.length; a++) {
				const prev = allPoints[a - 1];
				const curr = allPoints[a];
				cumulativeDistance += LatLngDist(
					prev.lat,
					prev.lng,
					curr.lat,
					curr.lng,
				);
				allPoints[a].cumulativeDistanceKm = cumulativeDistance;
			}
			feature.totalDistanceKm = cumulativeDistance;
			for (const segment of feature.properties.segments ?? []) {
				for (const step of segment.steps ?? []) {
					const atPoint = step.way_points[0];
					const instructions = step.instruction;
					try {
						allPoints[atPoint].instructions = instructions;
					} catch {
						// ignore
					}
				}
			}
			for (let a = 0; a < allPoints.length; a++) {
				if (!("instructions" in allPoints[a])) continue;
				let distanceToNext = 0;
				let b;
				for (b = a + 1; b < allPoints.length; b++) {
					const prev = allPoints[b - 1];
					const curr = allPoints[b];
					distanceToNext += LatLngDist(prev.lat, prev.lng, curr.lat, curr.lng);
					if ("instructions" in curr) break;
				}
				allPoints[a].distanceToNextKm = distanceToNext;
				allPoints[a].nextInstructionAt = b;
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
