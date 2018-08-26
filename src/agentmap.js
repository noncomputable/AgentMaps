/* The Agentmap class, which turns a Leaflet map into a simulation platform. */

let lineSlice = require('@turf/line-slice').default,
lineDistance = require('@turf/line-distance');

/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map instance.
 * @property {object} map - A Leaflet Map instance.
 * @property {FeatureGroup} agents - A featureGroup containing all agents.
 * @property {FeatureGroup} units - A featureGroup containing all units.
 * @property {FeatureGroup} streets - A featureGroup containing all streets.
 * @property {object} state - Properties detailing the state of the simulation process.
 * @property {boolean} state.running - Whether the simulation is running or not.
 * @property {boolean} state.paused - Whether the simulation is paused.
 * @property {?number} state.animation_frame_id - The id of the agentmap's update function in the queue of functions to call for the coming animation frame.
 * @property {?number} state.ticks - The number of ticks elapsed since the start of the simulation.
 * @property {object} settings - Settings for the agentmap, filled with defaults.
 * @property {number} settings.movement_precision - On each interval of this many miliseconds between requestAnimationFrame calls, the agent's movements will be updated (for more precise movements than just updating on each call to requestAnimationFrame (60 fps max)).
 * @property {?function} update_func - User-defined function to be called on each update.
 */
Agentmap = function (map) {
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
	this.update_func = function() {};
};

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
 *
 * @param {number} rAF_time - Time passed by the browser's most recent animation frame.
 */
Agentmap.prototype.update = function(rAF_time) {
	this.state.ticks += 1;
	
	if (this.state.ticks === null) {
		this.state.ticks = 0;
	}

	//Execute user-provided per-tick instructions.
	this.update_func();

	this.agents.eachLayer(function(agent) {
		agent.update();
	});
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
 * @param {number} unit_id - The unique id of the unit whose door you want.
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
 * @param {number} unit_id - The unique id of the unit whose door's corresponding point on the street you want.
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
 * Given a point on a street, find the nearest intersection on that street (with any other street).
 * 
 * @param {LatLng} lat_lng - The coordinates of the point on the street to search from.
 * @param {Place} place - A place object corresponding to the street.
 * @returns {LatLng} - The coordinates of the nearest intersection.
 */
Agentmap.prototype.getNearestIntersection = function(lat_lng, place) {
	let street_id,
	street_feature;
	start_coords = L.A.pointToCoordinateArray(lat_lng);

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
			intersection_coords = L.A.pointToCoordinateArray(intersection_point),
			segment = lineSlice(start_coords, intersection_coords, street_feature),
			distance = lineDistance(segment);
			
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
