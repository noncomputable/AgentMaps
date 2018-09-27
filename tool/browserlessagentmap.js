/* The Agentmap class, which turns a Leaflet map into a simulation platform. */

let L = require("./featuretool").L,
lineSlice = require('@turf/line-slice').default,
length = require('@turf/length').default;

/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map instance.
 * @param {number} [animation_interval=1] - The number of steps agents must move before being redrawn. Given 1, they will be redrawn after every step. Given 0, the animation will not update at all. 1 by default. Must be a nonnegative integer.
 * @property {object} map - A Leaflet Map instance.
 * @property {FeatureGroup} agents - A featureGroup containing all agents.
 * @property {FeatureGroup} units - A featureGroup containing all units.
 * @property {FeatureGroup} streets - A featureGroup containing all streets.
 * @property {object} state - Properties detailing the state of the simulation process.
 * @property {boolean} state.running - Whether the simulation is running or not.
 * @property {boolean} state.paused - Whether the simulation is paused.
 * @property {?number} state.animation_frame_id - The id of the agentmap's update function in the queue of functions to call for the coming animation frame.
 * @property {?number} state.ticks - The number of ticks elapsed since the start of the simulation.
 * @property {number} animation_interval - The number of steps agents must move before being redrawn. Given 1, they will be redrawn after every step. Given 0, the animation will not update at all. 1 by default. Will be a nonnegative integer.
 * @property {?function} controller - User-defined function to be called on each update.
 */
Agentmap = function(map, animation_interval = 1) {
	Agentmap.checkAnimIntervalOption(animation_interval);

	this.map = map,
	this.units = null,
	this.streets = null,
	this.agents = null, 
	this.pathfinder = null,
	this.state = {
		running: false,
		paused: false,
		animation_frame_id: null,
		ticks: null,
	},
	this.controller = function() {},
	this.animation_interval = animation_interval
};

/**
 * Change the animation interval of the simulation & redraw the agents.
 *
 * @param {number} animation_interval - The desired animation interval to give the simulation. Must be a nonnegative integer.
 */
Agentmap.prototype.setAnimationInterval = function(animation_interval) {
	Agentmap.checkAnimIntervalOption(animation_interval);

	this.animation_interval = animation_interval;

	this.agents.eachLayer(agent => agent.setLatLng(agent._latlng));
}

/**
 * Check whether the animation interval option provided is valid.
 * @private
 *
 * @param {number} animation_interval - An input specifying an animation interval distance.
 */
Agentmap.checkAnimIntervalOption = function(animation_interval) {
	if (!Number.isInteger(animation_interval) && animation_interval >= 0) {
		throw new Error("The animation_interval must be a non-negative integer!");
	}
}

/**
 * Get an animation frame, have the agents update & get ready to be drawn, and keep doing that until paused or reset.
 */
Agentmap.prototype.run = function() {
	if (this.state.running === false) {
		this.state.running = true;

		let animation_update = (function (rAF_time) {
			
			if (this.state.paused === true) {
				this.state.paused = false;
			}
			this.state.animation_frame_id = L.Util.requestAnimFrame(animation_update);
			this.update();
		}).bind(this);

		this.state.animation_frame_id = L.Util.requestAnimFrame(animation_update);
	}
}

/**
 * Update the simulation at the given time.
 * @private
 */
Agentmap.prototype.update = function() {
	if (this.state.ticks === null) {
		this.state.ticks = 0;
	}

	//Execute user-provided per-tick instructions for the agentmap.
	this.controller();

	//Execute user-provided per-tick instructions for each agent.
	this.agents.eachLayer(function(agent) {
		agent.controller();
	});
	
	this.state.ticks += 1;
};

/**
* Stop the animation, reset the animation state properties, and delete the features.
*/
Agentmap.prototype.clear = function() {
	L.Util.cancelAnimFrame(this.state.animation_frame_id);
	this.state.running = false,
	this.state.paused = false,
	this.state.animation_frame_id = null,
	this.state.ticks = null,
	
	this.agents.clearLayers();
	this.streets.clearLayers();
	this.units.clearLayers();
};

/** 
 * Stop the animation, stop updating the agents.
 */
Agentmap.prototype.pause = function() {
	L.Util.cancelAnimFrame(this.state.animation_frame_id);
	this.state.running = false,
	this.state.paused = true;
};

/**
 * Get a point through which an agent can exit/enter a unit.
 *
 * @param {number} unit_id - The unique ID of the unit whose door you want.
 * @returns {LatLng} - The coordinates of the center point of the segment of the unit parallel to the street.
 */
Agentmap.prototype.getUnitDoor = function(unit_id) {
	let unit = this.units.getLayer(unit_id);
	
	if (typeof(unit) === "undefined") {
		throw new Error("No unit with the specified ID exists.");
	}
	
	let unit_spec = unit.getLatLngs()[0],
	corner_a = unit_spec[0],
	corner_b = unit_spec[1],
	door = 	L.latLngBounds(corner_a, corner_b).getCenter();
	
	return door;
};

/**
 * Get the point on the adjacent street in front of the unit's door.
 *
 * @param {number} unit_id - The unique ID of the unit whose door's corresponding point on the street you want.
 * @returns {LatLng} - The coordinates point of the adjacent street directly in front of unit's door.
 */
Agentmap.prototype.getStreetNearDoor = function(unit_id) {
	let unit = this.units.getLayer(unit_id);
	
	if (typeof(unit) === "undefined") {
		throw new Error("No unit with the specified ID exists.");
	}
	
	let unit_anchors = L.A.reversedCoordinates(unit.street_anchors),
	street_point = L.latLngBounds(...unit_anchors).getCenter();
	
	return street_point;
};

/**
 * Given a unit and a pair of coordinates between 0 and 1, return a corresponding point inside the unit, offset from its first corner along the street.
 * 
 * @param {number} unit_id - The unique ID of the unit whose interior point you want.
 * @param {number} x - A point between 0 and 1 representing a position along the width of a unit.
 * @param {number} y - A point between 0 and 1 representing a position along the depth of a unit.
 * @returns {LatLng} - The global coordinates of the specified position within the unit.
 */
Agentmap.prototype.getUnitPoint = function(unit_id, x, y) {
	if (x < 0 || x > 1 || y < 0 || y > 1) {
		throw new Error("x and y must both be between 0 and 1!");
	}
	
	let unit = this.units.getLayer(unit_id),
	unit_corners = unit.getLatLngs()[0],
	front_right = unit_corners[0],
	front_left = unit_corners[1],
	back_right = unit_corners[3],
	front_length = front_left.lng - front_right.lng,
	side_length = back_right.lng - front_right.lng,
	front_slope = (front_right.lat - front_left.lat) / (front_right.lng - front_left.lng),
	side_slope = (front_right.lat - back_right.lat) / (front_right.lng - back_right.lng);
	
	//Get the coordinate of the position along the front (x) axis.
	let lng_along_front = front_right.lng + front_length * x,
	lat_along_front = front_right.lat + (front_length * x) * front_slope,
	point_along_front = L.latLng(lat_along_front, lng_along_front);
	
	//From the position on the front axis, get the coordinate of a position along a line perpendicular to the front and 
	//parallel to the side (y) axis.
	let lng_along_side = point_along_front.lng + side_length * y,
	lat_along_side = point_along_front.lat + (side_length * y) * side_slope,
	point_in_depth = L.latLng(lat_along_side, lng_along_side);

	return point_in_depth;
}

/**
 * Given a point on a street, find the nearest intersection on that street (with any other street).
 * 
 * @param {LatLng} lat_lng - The coordinates of the point on the street to search from.
 * @param {Place} place - A place object corresponding to the street.
 * @returns {LatLng} - The coordinates of the nearest intersection.
 */
Agentmap.prototype.getNearestIntersection = function(lat_lng, place) {
	let street_id,
	street_feature;

	if (place.type === "street") {
		street_id = place.id;
	}
	else {
		throw new Error("place must be a street!");
	}

	street_feature = this.streets.getLayer(street_id).toGeoJSON();
		
	let intersections = this.streets.getLayer(street_id).intersections,
	intersection_points = [],
	intersection_distances = [];

	for (let intersection in intersections) { 
		for (let cross_point of intersections[intersection]) {
			let intersection_point = cross_point[0],
			distance = lat_lng.distanceTo(intersection_point);

			/* More precise, but slower, distance detection -- not necessary yet. 
			 	let start_coords = L.A.pointToCoordinateArray(lat_lng);
				intersection_coords = L.A.pointToCoordinateArray(intersection_point),
				segment = lineSlice(start_coords, intersection_coords, street_feature),
				distance = length(segment); 
			*/
			
			intersection_points.push(intersection_point);
			intersection_distances.push(distance);
		}
	}
	
	let smallest_distance = Math.min(...intersection_distances),
	smallest_distance_index = intersection_distances.indexOf(smallest_distance),
	closest_intersection_point = L.latLng(intersection_points[smallest_distance_index]);
	
	return closest_intersection_point;
}

/**
 * Since units may take a noticeably long time to generate while typically staying the same over simulations,
 * downloadUnits makes it easy to get a JS file containing the units object, so it can be included with an
 * AgentMaps app and imported into Agentmap.buildingify so they will not need to be regenerated.
 */
Agentmap.prototype.downloadUnits = function() {
	let file_content = "let units_data = ",
	units_json = this.units.toGeoJSON(20);
	file_content += JSON.stringify(units_json),
	file = new Blob([file_content]);

	var element = document.createElement("a");
	element.setAttribute("href", URL.createObjectURL(file)),
	element.setAttribute("download", "units_data.js"),
	element.style.display = "none";
	document.body.appendChild(element);
	
	element.click();
	
	document.body.removeChild(element);
}

/**
 * Generates an agentmap for the given map.
 *
 * @name agentmap
 * @param {object} map - A Leaflet Map instance.
 * @returns {object} - An Agentmap instance.
 */
function agentmapFactory(map) {
	return new Agentmap(map);
}

/**
 * Returns the number of layers in a Leaflet layer group.
 *
 * @memberof L.LayerGroup
 */
function layerCount() {
	return this.getLayers().length;
}

L.LayerGroup.include({count: layerCount});

exports.Agentmap = Agentmap,
exports.agentmap = agentmapFactory;
