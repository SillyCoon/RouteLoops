import { directions } from "./directions.js";
import { improvementCycle } from "./improvementCycle.js";

export const cleanDirections = async (query) => {
	const { features } = await directions(query);
	const initialPoints = query.waypoints ?? [];
	const allPoints = features[0]?.allPoints ?? [];
	return improvementCycle(allPoints, initialPoints, query);
};
