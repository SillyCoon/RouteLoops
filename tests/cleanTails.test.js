import { expect, test, describe } from "bun:test";
import { cleanTails } from "../cleanTails.js";

describe("cleanTails tail removal", () => {
	test("removes small loop tail from route", async () => {
		// Create a route with a small loop/tail (< 20% of total)
		// Make the main route much longer so the tail is proportionally small
		const routeWithTail = [
			{ lat: 0, lng: 0 }, // Start
			{ lat: 0.02, lng: 0 }, // Point 1 (longer segment)
			{ lat: 0.04, lng: 0 }, // Point 2 (longer segment)
			{ lat: 0.0401, lng: 0.0001 }, // Small detour start
			{ lat: 0.0402, lng: 0.0001 }, // Small detour middle
			{ lat: 0.04000001, lng: 0 }, // Back very close to Point 2
			{ lat: 0.08, lng: 0 }, // Point 3 (much farther)
			{ lat: 0.12, lng: 0 }, // End (much farther to make tail small %)
		];

		const result = await cleanTails(routeWithTail);

		// Should remove the detour points
		expect(result.cleanedUp).toBeGreaterThan(0);
		expect(result.newPath.length).toBeLessThan(routeWithTail.length);

		// Should keep start and end points
		expect(result.newPath[0]).toEqual(routeWithTail[0]);
		expect(result.newPath[result.newPath.length - 1]).toEqual(
			routeWithTail[routeWithTail.length - 1],
		);
	});

	test("preserves route without tails", async () => {
		// Simple straight line route
		const straightRoute = [
			{ lat: 0, lng: 0 },
			{ lat: 0.01, lng: 0 },
			{ lat: 0.02, lng: 0 },
			{ lat: 0.03, lng: 0 },
		];

		const result = await cleanTails(straightRoute);

		// Should not remove any points
		expect(result.cleanedUp).toBe(0);
		expect(result.newPath.length).toBe(straightRoute.length);
	});

	test("handles large tails correctly", async () => {
		// Route with a large loop (>20% of total)
		const routeWithLargeTail = [
			{ lat: 0, lng: 0 }, // Start
			{ lat: 0.01, lng: 0 }, // Point 1
			{ lat: 0.01, lng: 0.05 }, // Large detour
			{ lat: 0, lng: 0.05 }, // Large detour
			{ lat: 0.01, lng: 0 }, // Back to Point 1
			{ lat: 0.02, lng: 0 }, // End
		];

		const result = await cleanTails(routeWithLargeTail);

		// Should NOT remove the large loop (>20%)
		expect(result.newPath.length).toBe(routeWithLargeTail.length);
	});

	test("handles empty and single point routes", async () => {
		// Empty route
		let result = await cleanTails([]);
		expect(result.cleanedUp).toBe(0);
		expect(result.newPath).toEqual([]);

		// Single point route
		result = await cleanTails([{ lat: 0, lng: 0 }]);
		expect(result.cleanedUp).toBe(0);
		expect(result.newPath).toEqual([{ lat: 0, lng: 0 }]);
	});

	test("removes multiple small tails", async () => {
		// Route with multiple small loops
		const routeWithMultipleTails = [
			{ lat: 0, lng: 0 }, // Start
			{ lat: 0.01, lng: 0 }, // Point 1
			{ lat: 0.01, lng: 0.005 }, // Small loop 1
			{ lat: 0.01, lng: 0 }, // Back to Point 1
			{ lat: 0.02, lng: 0 }, // Point 2
			{ lat: 0.02, lng: 0.005 }, // Small loop 2
			{ lat: 0.02, lng: 0 }, // Back to Point 2
			{ lat: 0.03, lng: 0 }, // End
		];

		const result = await cleanTails(routeWithMultipleTails);

		// Should remove both small loops
		expect(result.cleanedUp).toBeGreaterThan(0);
		expect(result.newPath.length).toBeLessThan(routeWithMultipleTails.length);

		// Should keep start and end points
		expect(result.newPath[0]).toEqual(routeWithMultipleTails[0]);
		expect(result.newPath[result.newPath.length - 1]).toEqual(
			routeWithMultipleTails[routeWithMultipleTails.length - 1],
		);
	});
});
