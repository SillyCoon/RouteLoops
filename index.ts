import html from "./index.html";
import { cleanDirections } from "./server/directions/cleanDirections";
import { parseQuery } from "./server/directions/query";
import { getRLpoints, parseQuery as parseRLQuery } from "./server/rlpoints";

const server = Bun.serve({
	routes: {
		"/": html,
		"/getRLpoints": async (req) => {
			const { searchParams } = new URL(req.url);
			const waypoints = await getRLpoints(parseRLQuery(searchParams));
			console.log("Generated waypoints:", waypoints);
			return Response.json(waypoints);
		},
		"/cleanDirections": async (req) => {
			const { searchParams } = new URL(req.url);
			return new Response(
				async function* () {
					for await (const data of cleanDirections(parseQuery(searchParams))) {
						if (data.iteration === 0) {
							yield `event: start\n`;
						} else {
							yield `event: refinement\n`;
						}
						yield `data: ${JSON.stringify(data)}\n\n`;
					}
					yield `event: end\ndata: done\n\n`;
				},
				{
					headers: {
						"Cache-Control": "no-cache",
						"Content-Type": "text/event-stream",
						"Access-Control-Allow-Origin": "*",
						Connection: "keep-alive",
					},
				},
			);
		},
	},

	// (optional) fallback for unmatched routes:
	// Required if Bun's version < 1.2.3
	fetch(req) {
		return new Response("Not Found", { status: 404 });
	},
});

console.log(`Server running at ${server.url}`);
