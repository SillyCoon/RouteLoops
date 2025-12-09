// Shared helper to compute distance between two lat/lng points in km.
function LatLngDist(lat1, lon1, lat2, lon2) {
	const R = 6371; // km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Helpers
export function parseQuery(url) {
	const result = {
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
	if (qIndex >= 0) {
		const search = url.slice(qIndex + 1);
		const params = new URLSearchParams(search);
		result.lat = params.get("lat") ?? result.lat;
		result.lng = params.get("lng") ?? result.lng;
		result.highways = params.get("highways") ?? result.highways;
		result.ferries = params.get("ferries") ?? result.ferries;
		result.waypoints = params.get("waypoints") ?? result.waypoints;
		result.mode = params.get("mode") ?? result.mode;
		result.fitnessLevel = params.get("fitnessLevel") ?? result.fitnessLevel;
		result.greenFactor = params.get("greenFactor") ?? result.greenFactor;
		result.quietFactor = params.get("quietFactor") ?? result.quietFactor;
	}
	return result;
}

export function buildCoordinates(result) {
	const coordinates = [];
	if (result.lng != null && result.lat != null) {
		coordinates.push([result.lng, result.lat]);
	}
	const wptsText = result.waypoints ?? "";
	if (wptsText.length > 0) {
		const theWayPoints = wptsText.split("|");
		for (const wp of theWayPoints) {
			const parts = wp.split(",");
			if (parts.length === 2) {
				const lat = parts[0];
				const lng = parts[1];
				const latNum = Number(lat);
				const lngNum = Number(lng);
				if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
					coordinates.push([lng, lat]);
				}
			}
		}
	}
	if (result.lng != null && result.lat != null) {
		coordinates.push([result.lng, result.lat]);
	}
	return coordinates;
}

export function buildOptions(result) {
	const options = { avoid_features: [], profile_params: { weightings: {} } };
	const mode = result.mode ?? "cycling-regular";
	const isDriving = mode.indexOf("driv") >= 0;
	const isCycling = mode.indexOf("cycl") >= 0;
	const isFoot = mode.indexOf("foot") >= 0;

	const tolls = result.highways === "yes" ? "yes" : "no"; // original behavior
	if (isDriving && tolls === "yes") options.avoid_features.push("tollways");
	if ((isDriving || isCycling || isFoot) && result.ferries === "yes")
		options.avoid_features.push("ferries");
	if (isDriving && result.highways === "yes")
		options.avoid_features.push("highways");

	options.profile_params.weightings.steepness_difficulty =
		1 * result.fitnessLevel;
	options.profile_params.weightings.green = 1 * result.greenFactor;
	options.profile_params.weightings.quiet = 1 * result.quietFactor;

	return options;
}

const fetchDirections = async (mode, data) => {
	const response = await fetch(
		`https://api.openrouteservice.org/v2/directions/${mode}/geojson`,
		{
			method: "POST",
			body: JSON.stringify(data),
			headers: {
				Accept:
					"application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
				Authorization: process.env.OSM_API_KEY,
				"Content-Type": "application/json; charset=utf-8",
			},
		},
	);
	return response.json();
};

async function directions(req, res) {
	const url = req.url;
	let theJson = null;

	const result = parseQuery(url);
	console.log("Doing a directions GET call:");

	const coordinates = buildCoordinates(result);
	const options = buildOptions(result);

	let tryAgain = true;
	let directionsError = null;
	while (tryAgain) {
		const data = { coordinates, options };

		try {
			theJson = await fetchDirections(result.mode, data);
		} catch (error) {
			console.log("Error fetching directions from OpenRouteService:", error);
		}

		console.log(api_root);
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
			const allPoints = [];
			for (const coordinate of feature.geometry.coordinates ?? []) {
				allPoints.push({ lat: coordinate[1], lng: coordinate[0] });
			}
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
				cumulativeDistance += LatLngDist(
					allPoints[a - 1].lat,
					allPoints[a - 1].lng,
					allPoints[a].lat,
					allPoints[a].lng,
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
					distanceToNext += LatLngDist(
						allPoints[b - 1].lat,
						allPoints[b - 1].lng,
						allPoints[b].lat,
						allPoints[b].lng,
					);
					if ("instructions" in allPoints[b]) break;
				}
				allPoints[a].distanceToNextKm = distanceToNext;
				allPoints[a].nextInstructionAt = b;
				a = b - 1;
			}

			feature.allPoints = allPoints;
		}

		res.json(theJson);
	} else {
		res.json({ status: "NG", error: directionsError });
	}
}

export { directions, LatLngDist };
