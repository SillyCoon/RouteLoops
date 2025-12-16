import { LatLngDist } from "./directions.js";

// Compute cumulative distances along a path of lat/lng points.
const cumulativeDistances = (points: { lat: number; lng: number }[]) => {
	const dists = [0];
	let cum = 0;
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		cum += a && b ? LatLngDist(a.lat, a.lng, b.lat, b.lng) : 0;
		dists.push(cum);
	}
	return { dists, total: cum };
};

// For each point i, find the closest subsequent point j>i by distance.
const closestForwardPoints = (points: { lat: number; lng: number }[]) => {
	const closestIndex = new Array(points.length).fill(null);
	const separation = new Array(points.length).fill(Infinity);
	for (let i = 0; i < points.length; i++) {
		const a = points[i];
		for (let j = i + 1; j < points.length; j++) {
			const b = points[j];
			const d = a && b ? LatLngDist(a.lat, a.lng, b.lat, b.lng) : 0;
			if (d < separation[i]) {
				separation[i] = d;
				closestIndex[i] = j;
			}
		}
	}
	return { closestIndex, separation };
};

// Decide which points to keep, skipping short tails (<20% of total length).
const decideUsage = (
	points: { lat: number; lng: number }[],
	dists: number[],
	total: number,
	closestIndex: (number | null)[],
) => {
	const use = new Array(points.length).fill(true);
	for (let i = 0; i < points.length; i++) {
		const j = closestIndex[i];
		if (j == null) continue;
		if (j - i !== 1) {
			const tailSize = ((dists?.[j] ?? 0) - (dists?.[i] ?? 0)) / (total || 1);
			if (tailSize < 0.2) {
				// Mark all intermediate points as unused
				for (let k = i + 1; k < j; k++) {
					use[k] = false;
				}
				// skip ahead to the closest point
				i = j - 1; // -1 because loop will increment
			}
		}
	}
	// Always keep endpoints
	if (points.length > 0) {
		use[0] = true;
		use[points.length - 1] = true;
	}
	return use;
};

const buildPath = (points: { lat: number; lng: number }[], use: boolean[]) =>
	points.filter((_, idx) => use[idx]);

/**
 * @param {Array<{lat: number, lng: number}>} path
 * @returns {number} The total distance of the path.
 */
const pathDistance = (path: { lat: number; lng: number }[]) => {
	let dist = 0;
	for (let i = 1; i < path.length; i++) {
		const first = path[i - 1];
		const second = path[i];
		dist +=
			first && second
				? LatLngDist(first.lat, first.lng, second.lat, second.lng)
				: 0;
	}
	return dist;
};

async function cleanTails(routeLatLng: { lat: number; lng: number }[]) {
	console.log("Cleaning tails for route with", routeLatLng.length, "points");
	if (!Array.isArray(routeLatLng) || routeLatLng.length < 2) {
		return { newPath: routeLatLng, cleanedUp: 0, distKm: 0 };
	}

	const points = routeLatLng.map(({ lat, lng }) => ({ lat, lng }));

	const { dists, total } = cumulativeDistances(points);
	const { closestIndex } = closestForwardPoints(points);
	const use = decideUsage(points, dists, total, closestIndex);
	// Count removed points for logging
	const removedCount = use.filter((u) => !u).length;
	console.log(
		`Tail analysis: ${removedCount} points marked for removal out of ${routeLatLng.length} total points`,
	);

	const newPath = buildPath(points, use);

	const cleanedUp = points.length - newPath.length;
	const finalDistance = pathDistance(newPath);

	console.log(
		`cleanTails trimmed ${cleanedUp} from ${routeLatLng.length} for ${finalDistance.toFixed(2)}km`,
	);

	return { newPath, cleanedUp, distKm: finalDistance };
}

export { cleanTails };
