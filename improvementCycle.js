import { cleanTails } from "./cleanTails.js";
import { directions } from "./directions.js";

const improvementIteration = async (
	allPoints,
	waypoints,
	prevLastCounts,
	directionsQuery,
) => {
	const cleanTailsJson = await cleanTails(allPoints);

	if (cleanTailsJson.cleanedUp === 0) {
		//No modifications were made, so stop
		return {
			keepGoing: false,
			distance: cleanTailsJson.distKm,
			lastCounts: {
				cleaned: cleanTailsJson.cleanedUp,
				total: allPoints.length,
			},
			waypoints,
			allPoints,
		};
	}

	// You modified the path, so redo with the cleaned path.
	// FP-style: map each previous waypoint to closest point in newPath using reduce.
	const newWaypoints = waypoints.map((waypoint) => {
		const closest = cleanTailsJson.newPath.reduce((best, point) => {
			const separation =
				(waypoint.lat - point.lat) ** 2 + (waypoint.lng - point.lng) ** 2;
			if (best == null || separation < best.separation) {
				return { point, separation };
			}
			return best;
		}, null);
		return closest?.point ?? waypoint;
	});

	// Use the updated waypoint set for the next directions call
	const directionsJson = await directions({
		...directionsQuery,
		// directions.buildCoordinates expects "lat,lng" pairs
		waypoints: newWaypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|"),
	});
	const newPoints = directionsJson.features[0].allPoints;

	return {
		keepGoing: !(
			cleanTailsJson.cleanedUp === prevLastCounts.cleaned &&
			newPoints.length === prevLastCounts.total
		),
		distance: cleanTailsJson.distKm,
		lastCounts: {
			cleaned: cleanTailsJson.cleanedUp,
			total: newPoints.length,
		},
		waypoints: newWaypoints,
		allPoints: newPoints,
	};
};

export const improvementCycle = async (
	rawPoints,
	initialWaypoints,
	directionsQuery,
) => {
	let finalPoints = [...rawPoints];
	let waypoints = [...initialWaypoints];
	let lastCounts = { cleaned: -1, total: -1 };
	let distance = rawPoints[rawPoints.length - 1].cumulativeDistanceKm;
	let keepGoing = true;
	let countCalcs = 0;

	while (keepGoing) {
		countCalcs += 1;
		const iterationResult = await improvementIteration(
			finalPoints,
			waypoints,
			lastCounts,
			directionsQuery,
		);
		console.log("Iteration result", iterationResult);

		lastCounts = iterationResult.lastCounts;
		waypoints = iterationResult.waypoints;
		keepGoing = iterationResult.keepGoing;
		distance = iterationResult.distance;
		finalPoints = iterationResult.allPoints;
	}

	return { cleanPoints: finalPoints, waypoints, distance, countCalcs };
};
