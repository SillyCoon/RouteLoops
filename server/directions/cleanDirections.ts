import { directions } from "./directions.js";
import { improvementCycleGen } from "./improvementCycle.js";
import type { Query } from "./query.js";
import { cumulativeDistances } from "./utils.js";

export async function* cleanDirections(query: Query) {
	// Run base directions
	const allPoints = await directions(query);

	// Convert query waypoints ([lng,lat]) into {lat,lng} objects for improvementCycleGen
	const initialWaypoints = (query.waypoints ?? []).map(([lng, lat]) => ({
		lat,
		lng,
	}));

	yield {
		iteration: 0,
		distance: cumulativeDistances(allPoints).total,
		cleanedUp: 0,
		totalPoints: allPoints.length,
		waypoints: initialWaypoints,
		points: allPoints,
		keepGoing: true,
	};

	// Stream subsequent improvement iterations
	for await (const improvement of improvementCycleGen(
		allPoints,
		initialWaypoints,
		query,
	)) {
		yield improvement;
	}
}
