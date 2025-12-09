import { LatLngDist } from "./directions.js";

async function cleanTails(req, res) {
	const method = req.method;
	if (method.toLowerCase() === "post") {
		const body = req.body;
		const routeLatLng = body.LLs;

		const pLpoints = [];
		for (let i = 0; i < routeLatLng.length; i++)
			pLpoints.push({ lat: routeLatLng[i].lat, lng: routeLatLng[i].lng });

		const pLdist = [];
		pLdist.push(0);
		let cumulative = 0;
		const newPath = [];
		const pLuse = [];
		for (let i = 0; i < pLpoints.length - 1; i++) {
			pLuse.push(false);
			cumulative += LatLngDist(
				pLpoints[i].lat,
				pLpoints[i].lng,
				pLpoints[i + 1].lat,
				pLpoints[i + 1].lng,
			);
			pLdist.push(cumulative);
			newPath.push(pLpoints[i]);
		}
		newPath.push(pLpoints[pLpoints.length - 1]);

		let closest;
		let point;
		let dist;
		const pLclose = [];
		const pLsep = [];
		for (let i = 0; i < pLpoints.length; i++) {
			const thisOne = pLpoints[i];
			for (let j = i + 1; j < pLpoints.length; j++) {
				const thatOne = pLpoints[j];
				dist = LatLngDist(thisOne.lat, thisOne.lng, thatOne.lat, thatOne.lng);
				if (j === i + 1) {
					closest = dist;
					point = j;
				} else if (dist < closest) {
					closest = dist;
					point = j;
				}
			}
			pLclose[i] = point;
			pLsep[i] = closest;
		}

		let tailSize;
		for (let i = 0; i < pLpoints.length; i++) {
			pLuse[i] = true;
			if (pLclose[i] - i !== 1) {
				tailSize = (pLdist[pLclose[i]] - pLdist[i]) / cumulative;
				if (tailSize < 0.2) {
					i = pLclose[i];
				}
			}
		}

		newPath.length = 0;
		for (let i = 0; i < pLpoints.length; i++) {
			if (i === 0 || i === pLpoints.length - 1) pLuse[i] = true;
			if (pLuse[i]) newPath.push(pLpoints[i]);
		}

		const cleanedUp = pLpoints.length - newPath.length;

		let finalDistance = 0;
		for (let i = 1; i < newPath.length; i++)
			finalDistance += LatLngDist(
				newPath[i - 1].lat,
				newPath[i - 1].lng,
				newPath[i].lat,
				newPath[i].lng,
			);

		res.json({ newPath: newPath, cleanedUp: cleanedUp, distKm: finalDistance });
	}
}

export { cleanTails };
