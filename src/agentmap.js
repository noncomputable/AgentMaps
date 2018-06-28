var lineSlice = require('@turf/line-slice').default;
var lineDistance = require('@turf/line-distance');

/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map instance.
 * @property {object} map - A Leaflet Map instance.
 * @property {featureGroup} agents - A featureGroup containing all agents.
 * @property {featureGroup} units - A featureGroup containing all units.
 * @property {featureGroup} streets - A featureGroup containing all streets.
 * @property {object} state - Properties detailing the state of the simulation process.
 * @property {boolean} state.running - Whether the simulation is running or not.
 * @property {boolean} state.paused - Whether the simulation is paused.
 * @property {?number} state.animation_frame_id - The id of the agentmap's update function in the queue of functions to call for the coming animation frame.
 * @property {?number} state.tick - The number of ticks elapsed since the start of the simulation.
 * @property {?number} state.prev_tick - The tick (time in seconds) when the last update was started.
 * @property {?number} state.tick_start_delay - Ticks corresponding to the time of the last animation frame before the trip started. Subtracted from all subsequent tick measurements so that the clock starts at 0, instead of whatever the actual time of that initial animation frame was.
 * @property {object} settings - Settings for the agentmap, filled with defaults.
 * @property {number} settings.movement_precision - On each interval of this many miliseconds between requestAnimationFrame calls, the agent's movements will be updated (for more precise movements than just updating on each call to requestAnimationFrame (60 fps max).
 * @property {?function} update_func - Function to be called on each update.
 */
Agentmap = function (map) {
	this.map = map,
	this.units = null,
	this.streets = null,
	this.agents = null, 
	this.state = {
		running: false,
		paused: false,
		animation_frame_id: null,
		tick: null,
		prev_tick: null,
		tick_start_delay: null
	},
	this.settings = {
		movement_precision: .001
	},
	this.update_func = function() {};
};

/**
 * Get an animation frame, have the agents update & get ready to be drawn, and keep doing that until paused or reset.
 */
Agentmap.prototype.run = function() {
	if (this.state.running === false) {
		if (this.state.paused === true) {
			this.state.paused = false,
			this.state.tick -= this.state.tick - this.state.prev_tick;
		}

		this.state.running = true;
		
		let animation_update = (function (rAF_time) {
			this.update(rAF_time);
			
			this.state.animation_frame_id = L.Util.requestAnimFrame(animation_update);
		}).bind(this);

		this.animation_frame_id = L.Util.requestAnimFrame(animation_update);
	}
}

/**
 * Update the simulation at the given time.
 *
 * @param {number} rAF_time - Time passed by the browser's most recent animation frame.
 */
Agentmap.prototype.update = function(rAF_time) {
	let total_ticks = rAF_time * .001;
	
	if (this.state.tick === null) {
		this.state.tick = 0,
		this.state.prev_tick = 0,

		//requestAnimationFrame doesn't start with timestamp 0; the first timestamp will typically be pretty large; 
		//we want to store it and subtract it from each newly recieved tick at which we're animating so that ticks 
		//are counted from 0, not whatever timestamp the original call to rAF happened to return. 
		this.state.tick_start_delay = total_ticks;
	}
	else {
		//See the comment immediately above.
		this.state.tick = total_ticks - this.state.tick_start_delay;
	}

	this.update_func();

	let movement_precision = this.settings.movement_precision,
	animation_tick_interval = this.state.tick - this.state.prev_tick,
	steps_inbetween = Math.floor(animation_tick_interval / movement_precision);

	this.agents.eachLayer(function(agent) {
		agent.update(animation_tick_interval, movement_precision, steps_inbetween);
	});

	this.state.prev_tick = this.state.tick;
};

/**
* Stop the animation, reset the animation state properties, and delete the agents.
*/
Agentmap.prototype.reset = function() {
	L.Util.cancelAnimFrame(this.state.animation_frame_id);
	this.state.running = false,
	this.state.paused = false,
	this.state.animation_frame_id = null,
	this.state.tick = null,
	this.state.prev_tick = null,
	this.state.tick_start_delay = null;
	
	this.agents.clearLayers();
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
	side_a = unit_spec[0],
	side_b = unit_spec[1],
	door = 	L.latLngBounds(side_a, side_b).getCenter();
	
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

Agentmap.prototype.getNearestIntersection = function(lat_lng, place) {
	let coordinates,
	street_id,
	street_feature;

	if (place.unit) {
		coordinates = this.getStreetNearDoor(place.unit),
		unit = this.units.getLayer(place.unit),
		street_id = unit.street_id;
	}
	else if (place.street) {
		coordinates = lat_lng,
		street_id = place.street;
	}
	else {
		throw new Error("place must be a unit or a street!");
	}

	street_feature = this.streets.getLayer(street_id).toGeoJSON();
		
	let intersections = this.streets.getLayer(street_id).intersections,
	intersection_points = [],
	intersection_distances = [];

	for (let intersection in intersections) { 
		for (let cross_point of intersection) {
			let intersection_point = cross_point[0],
			start_coords = L.A.pointToCoordinateArray(coordinates),
			end_coords = L.A.pointToCoordinateArray(intersection_point),
			segment = lineSlice(start_coords, end_coords, street.toGeoJSON()),
			distance = lineDistance(segment);
			
			intersection_points.push(intersection_point);
			intersection_distances.push(distance);
		}
	}

	let smallest_distance = Math.min(...intersection_distances),
	smallest_distance_index = intersection_distances.indexOf(smallest_distance),
	closest_intersection_point = intersection_points[smallest_distance_index];

	return closest_intersection_point;
}

/**
 * Generates an agentmap for the given map.
 *
 * @param {object} map - A Leaflet Map instance.
 * @returns {object} - An Agentmap instance.
 */
function agentmapFactory(map) {
	return new Agentmap(map);
}

/**
 * Returns the number of layers in a Leaflet layer group.
 */
function layerCount() {
	return this.getLayers().length;
}

L.LayerGroup.include({count: layerCount});

exports.Agentmap = Agentmap,
exports.agentmap = agentmapFactory;
