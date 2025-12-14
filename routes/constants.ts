export const METERS_PER_DEGREE_LAT = 110540;
export const METERS_PER_DEGREE_LNG_EQUATOR = 111320;
export const METERS_PER_KILOMETER = 1000;

export const directionByHeading: Record<number | "default", number> = {
	0: Math.random() * Math.PI * 2,
	1: (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8,
	2: (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8,
	3: (Math.random() * Math.PI) / 4 - Math.PI / 8,
	4: (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8,
	5: (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8,
	6: (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8,
	7: (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8,
	8: (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8,
	default: Math.random() * Math.PI * 2,
};

export const signByRotation = {
	clockwise: -1,
	counterclockwise: +1,
};

export const calculatePoint = (
	location: { lat: number; lng: number },
	direction: number,
	radius: number,
) => {
	const dx = radius * Math.cos(direction);
	const dy = radius * Math.sin(direction);
	const delta_lat = dy / METERS_PER_DEGREE_LAT;
	const delta_lng =
		dx /
		(METERS_PER_DEGREE_LNG_EQUATOR * Math.cos((location.lat * Math.PI) / 180));
	return {
		lat: location.lat + delta_lat,
		lng: location.lng + delta_lng,
	};
};
