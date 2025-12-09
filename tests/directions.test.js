import { expect, test, describe } from "bun:test";
import {
	LatLngDist,
	parseQuery,
	buildCoordinates,
	buildOptions,
} from "../directions.js";

describe("directions helpers", () => {
	test("parseQuery parses and defaults", () => {
		const url =
			"/directions?lat=42.1&lng=-71.2&mode=cycling-regular&highways=yes&ferries=no&fitnessLevel=2&greenFactor=1&quietFactor=1&waypoints=42.0,-71.0|42.2,-71.1";
		const res = parseQuery(url);
		expect(res).toEqual({
			lat: "42.1",
			lng: "-71.2",
			highways: "yes",
			ferries: "no",
			waypoints: "42.0,-71.0|42.2,-71.1",
			mode: "cycling-regular",
			fitnessLevel: "2",
			greenFactor: "1",
			quietFactor: "1",
		});
	});

	test("buildCoordinates creates start, waypoints, end", () => {
		const res = {
			lat: "42.3",
			lng: "-71.3",
			waypoints: "42.0,-71.0|42.2,-71.1",
		};
		const coords = buildCoordinates(res);
		expect(coords).toEqual([
			["-71.3", "42.3"],
			["-71.0", "42.0"],
			["-71.1", "42.2"],
			["-71.3", "42.3"],
		]);
	});

	test("buildOptions flags and weightings", () => {
		const res = {
			mode: "driving-car",
			highways: "yes",
			ferries: "no",
			fitnessLevel: 3,
			greenFactor: 1,
			quietFactor: 0,
		};
		const opts = buildOptions(res);
		expect(opts).toEqual({
			avoid_features: ["tollways", "highways"],
			profile_params: {
				weightings: { steepness_difficulty: 3, green: 1, quiet: 0 },
			},
		});
	});

	test("buildCoordinates handles empty and malformed waypoints gracefully", () => {
		const resEmpty = { lat: "42.3", lng: "-71.3", waypoints: "" };
		const coordsEmpty = buildCoordinates(resEmpty);
		expect(coordsEmpty.length).toBe(2);
		expect(coordsEmpty[0]).toEqual(["-71.3", "42.3"]);
		expect(coordsEmpty[1]).toEqual(["-71.3", "42.3"]);

		const resBad = {
			lat: "42.3",
			lng: "-71.3",
			waypoints: "bad,value|42.2,-71.1|oops",
		};
		const coordsBad = buildCoordinates(resBad);
		expect(coordsBad).toEqual([
			["-71.3", "42.3"],
			["-71.1", "42.2"],
			["-71.3", "42.3"],
		]);
	});
});

describe("LatLngDist", () => {
	test("distance ~111km per degree at equator", () => {
		const d = LatLngDist(0, 0, 0, 1);
		expect(d).toBeGreaterThan(100);
		expect(Math.abs(d - 111)).toBeLessThan(2);
	});

	test("distance symmetry and triangle inequality sanity", () => {
		const a = LatLngDist(0, 0, 0, 1);
		const b = LatLngDist(0, 1, 0, 0);
		expect(Math.abs(a - b)).toBeLessThan(1e-9);

		const ab = LatLngDist(0, 0, 0, 1);
		const bc = LatLngDist(0, 1, 0, 2);
		const ac = LatLngDist(0, 0, 0, 2);
		expect(ab + bc).toBeGreaterThanOrEqual(ac - 1e-6);
	});
});
