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
 * @property {?number} state.time - The time elapsed since the start of the simulation.
 * @property {?number} state.ticks - The number of ticks elapsed since the start of the simulation.
 * @property {?number} state.prev_time - The time (time in seconds) when the last update was started.
 * @property {?number} state.time_start_delay - Ticks corresponding to the time of the last animation frame before the trip started. Subtracted from all subsequent time measurements so that the clock starts at 0, instead of whatever the actual time of that initial animation frame was.
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
		time: null,
		ticks: null,
		prev_time: null,
		time_start_delay: null
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
		this.state.running = true;

		let animation_update = (function (rAF_time) {
			let total_time = rAF_time * .001;
			
			if (this.state.paused === true) {
				this.state.paused = false,
				//The delay specifically due to the pause isn't the interval from the time at pause to the time at unpause,
				//but the interval from the time at pause (state.time, which already accounts for previous delays) to 
				//the time at unpause the already accumulated delays; the unpause time alone is much higher without accounting
				//for previous delays and so the pause delay will look much bigger than it actually is if you subtracted previous delays.
				this.state.time_start_delay += (total_time - this.state.time_start_delay) - this.state.time;
			}
			
			this.update(rAF_time);
			
			this.state.animation_frame_id = L.Util.requestAnimFrame(animation_update);
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
	let total_time = rAF_time * .001;
	this.state.ticks += 1;
	
	if (this.state.time === null) {
		this.state.time = 0,
		this.state.prev_time = 0,
		this.state.ticks = 0;

		//requestAnimationFrame doesn't start with timetamp 0; the first timetamp will typically be pretty large; 
		//we want to store this initial timetamp and subtract it from each subsequent timetamp so that time 
		//are counted from 0, not whatever timetamp the initial call to rAF happened to return. 
		this.state.time_start_delay = total_time;
	}
	else {
		//See the comment immediately above.
		this.state.time = total_time - this.state.time_start_delay;
	}

	//Execute user-provided per-tick instructions.
	this.update_func();

	let movement_precision = this.settings.movement_precision,
	animation_time_interval = this.state.time - this.state.prev_time,
	steps_inbetween = Math.floor(animation_time_interval / movement_precision);

	this.agents.eachLayer(function(agent) {
		agent.update(animation_time_interval, movement_precision, steps_inbetween);
	});

	this.state.prev_time = this.state.time;
};

/**
* Stop the animation, reset the animation state properties, and delete the features.
*/
Agentmap.prototype.clear = function() {
	L.Util.cancelAnimFrame(this.state.animation_frame_id);
	this.state.running = false,
	this.state.paused = false,
	this.state.animation_frame_id = null,
	this.state.time = null,
	this.state.ticks = null,
	this.state.prev_time = null,
	this.state.time_start_delay = null;
	
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

	if (place.street) {
		street_id = place.street;
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
