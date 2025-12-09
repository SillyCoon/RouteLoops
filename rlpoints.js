// Extracted without refactor from serverCodeOsm.js
// Provides getRLpoints, circleRoute, rectangleRoute, fig8Route

export async function getRLpoints(req, res, next) {
	var method = req.method;
	var url = req.url;
	if (method.toLowerCase() == "get") {
		var split1 = url.split("?");
		var result = {
			lat: null,
			lng: null,
			dist: null,
			units: null,
			method: null,
			direction: null,
			rotation: null,
		};
		if (split1.length > 1) {
			var query = split1[1];
			var split2 = query.split("&");
			for (var i = 0; i < split2.length; i++) {
				var split3 = split2[i].split("=");
				if (split3[0] == "lat") result.lat = split3[1];
				if (split3[0] == "lng") result.lng = split3[1];
				if (split3[0] == "dist") result.dist = split3[1];
				if (split3[0] == "units") result.units = split3[1];
				if (split3[0] == "method") result.method = split3[1];
				if (split3[0] == "direction") result.direction = split3[1];
				if (split3[0] == "rotation") result.rotation = split3[1];
			}
		}

		var LatLng = { lat: 1 * result.lat, lng: 1 * result.lng };

		var targetLengthInMeters = result.dist;

		var units = result.units;
		if (units == null) units = "imperial";
		if (units == "imperial") targetLengthInMeters *= (5280 * 12 * 2.54) / 100;
		if (units == "metric") targetLengthInMeters *= 1000;

		var direction = result.direction;
		if (direction == null) direction = 0;

		var rotation = result.rotation;
		if (rotation == null) rotation = "clockwise";

		var pickMethod = result.method;

		if (pickMethod == "random" || pickMethod == null) {
			var methods = ["circular", "rectangular", "figure8"];
			pickMethod = methods[Math.floor(Math.random() * methods.length)];
		}

		console.log(`picMethod of ${pickMethod} in direction ${direction} `);
		var rlPoints = [];
		if (pickMethod == "circular")
			rlPoints = circleRoute(LatLng, targetLengthInMeters, direction, rotation);
		if (pickMethod == "rectangular")
			rlPoints = rectangleRoute(
				LatLng,
				targetLengthInMeters,
				direction,
				rotation,
			);
		if (pickMethod == "figure8")
			rlPoints = fig8Route(LatLng, targetLengthInMeters, direction, rotation);

		res.json(rlPoints);
	} else if (method.toLowerCase() == "post") {
	}
}

function circleRoute(BaseLocation, length, travelHeading, rotation) {
	var radius = length / 2 / Math.PI;
	var circlePoints = 4;
	var deg = [];
	var rlPoints = [];

	var direction = Math.random() * 2 * Math.PI; //in radians
	if (travelHeading == 0)
		direction = Math.random() * 2 * Math.PI; //in radians
	else if (travelHeading == 1)
		direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (travelHeading == 2)
		direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (travelHeading == 3)
		direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (travelHeading == 4)
		direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (travelHeading == 5)
		direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (travelHeading == 6)
		direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (travelHeading == 7)
		direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (travelHeading == 8)
		direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	var dx = radius * Math.cos(direction);
	var dy = radius * Math.sin(direction);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	var center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.push(direction + Math.PI);
	var sign = -1;
	if (rotation == "clockwise") sign = -1;
	else sign = +1;

	for (var i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / 110540;
		delta_lng = dx / (111320 * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
	}

	return rlPoints;
}

function rectangleRoute(BaseLocation, length, travelHeading, rotation) {
	var direction = 0;
	var angle = 0;
	var rlPoints = [];

	var maxRatio = 5;
	var minRatio = 1 / maxRatio;
	var deltaRatio = maxRatio - minRatio;
	var ratio = Math.random() * deltaRatio + minRatio;
	var width = length / (2 * ratio + 2);
	var height = width * ratio;
	var diagonal = Math.sqrt(width * width + height * height);
	var theta = Math.acos(height / diagonal);

	if (travelHeading == 0)
		var direction = Math.random() * 2 * Math.PI; //in radians
	else if (travelHeading == 1)
		var direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (travelHeading == 2)
		var direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (travelHeading == 3)
		var direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (travelHeading == 4)
		var direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (travelHeading == 5)
		var direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (travelHeading == 6)
		var direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (travelHeading == 7)
		var direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (travelHeading == 8)
		var direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	var sign = -1;
	if (rotation == "clockwise") sign = -1;
	else sign = +1;

	angle = 0 + direction; // height direction
	var dx = height * Math.cos(angle);
	var dy = height * Math.sin(angle);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	angle = sign * theta + direction; // diagonal direction
	var dx = diagonal * Math.cos(angle);
	var dy = diagonal * Math.sin(angle);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	angle = (sign * Math.PI) / 2 + direction; // width direction
	var dx = width * Math.cos(angle);
	var dy = width * Math.sin(angle);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	rlPoints.push({
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	});

	return rlPoints;
}

function fig8Route(BaseLocation, length, travelHeading, rotation) {
	var radius = length / 4 / Math.PI;
	var circlePoints = 3;
	var deg = [];
	var rlPoints = [];
	var rlpCount;

	if (travelHeading == 0)
		var direction = Math.random() * 2 * Math.PI; //in radians
	else if (travelHeading == 1)
		var direction = (Math.random() * Math.PI) / 4 + (3 * Math.PI) / 8;
	else if (travelHeading == 2)
		var direction = (Math.random() * Math.PI) / 4 + (1 * Math.PI) / 8;
	else if (travelHeading == 3)
		var direction = (Math.random() * Math.PI) / 4 - Math.PI / 8;
	else if (travelHeading == 4)
		var direction = (Math.random() * Math.PI) / 4 + (13 * Math.PI) / 8;
	else if (travelHeading == 5)
		var direction = (Math.random() * Math.PI) / 4 + (11 * Math.PI) / 8;
	else if (travelHeading == 6)
		var direction = (Math.random() * Math.PI) / 4 + (9 * Math.PI) / 8;
	else if (travelHeading == 7)
		var direction = (Math.random() * Math.PI) / 4 + (7 * Math.PI) / 8;
	else if (travelHeading == 8)
		var direction = (Math.random() * Math.PI) / 4 + (5 * Math.PI) / 8;

	var dx = radius * Math.cos(direction);
	var dy = radius * Math.sin(direction);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	var center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.push(direction + Math.PI);
	var sign = -1;
	if (rotation == "clockwise") sign = -1;
	else sign = +1;

	rlpCount = 0;

	for (var i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / 110540;
		delta_lng = dx / (111320 * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
		rlpCount++;
	}

	direction = direction + Math.PI;

	var dx = radius * Math.cos(direction);
	var dy = radius * Math.sin(direction);
	var delta_lat = dy / 110540;
	var delta_lng = dx / (111320 * Math.cos((BaseLocation.lat * Math.PI) / 180));
	center = {
		lat: BaseLocation.lat + delta_lat,
		lng: BaseLocation.lng + delta_lng,
	};

	deg.length = 0;
	deg.push(direction + Math.PI);
	var sign = +1;
	if (rotation == "clockwise") sign = +1;
	else sign = -1;

	for (var i = 1; i < circlePoints + 1; i++) {
		deg.push(deg[i - 1] + (sign * 2 * Math.PI) / (circlePoints + 1));
		dx = radius * Math.cos(deg[i]);
		dy = radius * Math.sin(deg[i]);
		delta_lat = dy / 110540;
		delta_lng = dx / (111320 * Math.cos((center.lat * Math.PI) / 180));
		rlPoints.push({ lat: center.lat + delta_lat, lng: center.lng + delta_lng });
		rlpCount++;
	}

	return rlPoints;
}
