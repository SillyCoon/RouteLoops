import fetch from "node-fetch";

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

async function directions(req, res, next) {
	const method = req.method;
	const url = req.url;

	if (method.toLowerCase() === "get") {
		const split1 = url.split("?");
		const result = {
			lat: null,
			lng: null,
			highways: null,
			ferries: null,
			waypoints: null,
			mode: null,
			fitnessLevel: null,
			greenFactor: null,
			quietFactor: null,
		};
		if (split1.length > 1) {
			const query = split1[1];
			const split2 = query.split("&");
			for (let i = 0; i < split2.length; i++) {
				const split3 = split2[i].split("=");
				if (split3[0] === "lat") result.lat = split3[1];
				if (split3[0] === "lng") result.lng = split3[1];
				if (split3[0] === "highways") result.highways = split3[1];
				if (split3[0] === "ferries") result.ferries = split3[1];
				if (split3[0] === "waypoints") result.waypoints = split3[1];
				if (split3[0] === "mode") result.mode = split3[1];
				if (split3[0] === "fitnessLevel") result.fitnessLevel = split3[1];
				if (split3[0] === "greenFactor") result.greenFactor = split3[1];
				if (split3[0] === "quietFactor") result.quietFactor = split3[1];
			}
		}
		console.log("Doing a directions GET call:");

		let avoids = "tolls";
		if (result.ferries === "yes") avoids += "|ferries";
		if (result.highways === "yes") avoids += "|highways";

		const api_root = `https://api.openrouteservice.org/v2/directions/${result.mode}/geojson`;
		const key = process.env.OSM_API_KEY;

		const ApiHeaders = {
			Accept:
				"application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
			Authorization: key,
			"Content-Type": "application/json; charset=utf-8",
		};
		const theWayPoints = result.waypoints.split("|");
		const wpts = [];
		for (let i = 0; i < theWayPoints.length; i++) {
			const thisWayPoint = theWayPoints[i].split(",");
			const theWayPoint = { lat: thisWayPoint[0], lng: thisWayPoint[1] };
			wpts.push(theWayPoint);
		}

		const coordinates = [];
		coordinates.push([result.lng, result.lat]);
		for (const waypoint of wpts) coordinates.push([waypoint.lng, waypoint.lat]);
		coordinates.push([result.lng, result.lat]);

		result.tolls = "no";
		if (result.highways === "yes") result.tolls = "yes";
		const options = {};
		options.avoid_features = [];
		if (result.mode.indexOf("driv") >= 0 && result.tolls === "yes")
			options.avoid_features.push("tollways");
		if (
			(result.mode.indexOf("driv") >= 0 ||
				result.mode.indexOf("cycl") >= 0 ||
				result.mode.indexOf("foot") >= 0) &&
			result.ferries === "yes"
		)
			options.avoid_features.push("ferries");
		if (result.mode.indexOf("driv") >= 0 && result.highways === "yes")
			options.avoid_features.push("highways");

		options.profile_params = { weightings: {} };
		options.profile_params.weightings.steepness_difficulty =
			1 * result.fitnessLevel;
		options.profile_params.weightings.green = 1 * result.greenFactor;
		options.profile_params.weightings.quiet = 1 * result.quietFactor;

		let tryAgain = true;
		let directionsError = null;
		while (tryAgain) {
			const data = { coordinates: coordinates, options: options };

			try {
				const response = await fetch(api_root, {
					method: "POST",
					body: JSON.stringify(data),
					headers: ApiHeaders,
				});
				var theJson = await response.json();
			} catch (error) {
				console.log("Error fetching directions from OpenRouteService:", error);
			}

			console.log(api_root);
			console.log(JSON.stringify(data));

			if (theJson && theJson.hasOwnProperty("error")) {
				if (
					theJson.error.message.indexOf("Could not find routable point") >= 0
				) {
					const split = theJson.error.message.split("coordinate");
					const info = split[1].trim();
					const split2 = info.split(":");
					const badCoord = split2[0];
					const badLL = split2[1].trim();
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
				for (const coordinate of feature.geometry.coordinates) {
					allPoints.push({ lat: coordinate[1], lng: coordinate[0] });
				}
				for (let a = allPoints.length - 1; a >= 1; a--) {
					if (
						allPoints[a].lat == allPoints[a - 1].lat &&
						allPoints[a].lng == allPoints[a - 1].lng
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
				for (const segment of feature.properties.segments) {
					for (const step of segment.steps) {
						const atPoint = step.way_points[0];
						const instructions = step.instruction;
						try {
							allPoints[atPoint].instructions = instructions;
						} catch (err) {}
					}
				}
				for (let a = 0; a < allPoints.length; a++) {
					if (!allPoints[a].hasOwnProperty("instructions")) continue;
					let distanceToNext = 0;
					let b;
					for (b = a + 1; b < allPoints.length; b++) {
						distanceToNext += LatLngDist(
							allPoints[b - 1].lat,
							allPoints[b - 1].lng,
							allPoints[b].lat,
							allPoints[b].lng,
						);
						if (allPoints[b].hasOwnProperty("instructions")) break;
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
	} else if (method.toLowerCase() === "post") {
	}
}

export { directions, LatLngDist };
