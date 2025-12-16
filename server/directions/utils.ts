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

// Compute cumulative distances along a path of lat/lng points.
export const cumulativeDistances = (points: { lat: number; lng: number }[]) => {
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
