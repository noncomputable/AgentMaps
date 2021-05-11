/* This file is part of AgentMaps which is released under the Simplified BSD License. */

/* Here we define agentify, the agent base class, and everything they uniquely rely on. */

let centroid = require('@turf/centroid').default,
buffer = require('@turf/buffer').default,
booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default,
along = require('@turf/along').default,
nearestPointOnLine = require('@turf/nearest-point-on-line').default,
lineSlice = require('@turf/line-slice').default,
length = require('@turf/length').default,
lineString = require('@turf/helpers').lineString,
bearing = require('@turf/bearing').default,
destination = require('@turf/destination').default,
Agentmap = require('./agentmap').Agentmap,
encodeLatLng = require('./routing').encodeLatLng;

/**
 * The main class representing individual agents, using Leaflet class system.
 * @private
 *
 * @class Agent
 */
let Agent = {};

/**
 * Constructor for the Agent class, using Leaflet class system.
 * 
 * @name Agent
 * @constructor 
 * @param {LatLng} lat_lng - A pair of coordinates to place the agent at.
 * @param {Object} options - An array of options for the agent, namely its layer.
 * @param {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {Place} place - A place object specifying where the agent is currently at.
 * @property {number} [steps_made=0] - The number of steps the agent has moved since the beginning.
 * @property {Object} this.trip - Properties detailing information about the agent's trip that change sometimes, but needs to be accessed by future updates.
 * @property {boolean} this.trip.moving - Whether the agent currently moving.
 * @property {boolean} this.trip.paused - Whether the agent should be allowed to move along its trip.
 * @property {?Point} this.trip.current_point - The point where the agent is currently located.
 * @property {?Point} this.trip.goal_point - The point where the agent is traveling to.
 * @property {?number} this.trip.lat_dir - The latitudinal direction. -1 if traveling to lower latitude (down), 1 if traveling to higher latitude (up).
 * @property {?number} this.trip.lng_dir - The longitudinal direction. -1 if traveling to lesser longitude (left), 1 if traveling to greater longitude (right).
 * @property {?number} this.trip.speed - The speed that the agent should travel, in meters per tick.
 * @property {?number} this.trip.angle - The angle between the current point and the goal.
 * @property {?number} this.trip.slope - The slope of the line segment formed by the two points between which the agent is traveling at this time during its trip.
 * @property {Array} this.trip.path - A sequence of LatLngs; the agent will move from one to the next, popping each one off after it arrives until the end of the street; or, until the trip is changed/reset.
 * @property {?function} controller - User-defined function to be called on each update (each tick).
 * @property {?function} fine_controller - User-defined function to be called before & after each movemnt (on each step an agent performs during a tick).
 */
Agent.initialize = function(lat_lng, options, agentmap) {
	this.agentmap = agentmap,
	this.place = null,
	this.steps_made = 0,
	this.trip = {
		paused: false,
		moving: false,
		current_point: null,
		goal_point: null,
		lat_dir: null,
		lng_dir: null,
		slope: null,
		angle: null,
		speed: null,
		path: [],
	},
	this.controller = function() {},
	this.fine_controller = function() {};

	L.CircleMarker.prototype.initialize.call(this, lat_lng, options);
}

/**
 * Reset all the properties of its trip, but don't change whether it's allowed to be traveling or not.
 * @memberof Agent
 * @instance
 */
Agent.resetTrip = function() {
	for (let key in this.trip) {
		this.trip[key] = 
			key === "paused" ? false : 
			key === "moving" ? false : 
			key === "path" ? [] :
			null;
	}
};

/**
 * Set the agent up to start traveling along the path specified in the agent's trip..
 * @memberof Agent
 * @instance
 */
Agent.startTrip = function() {
	if (this.trip.path.length > 0) {
		this.travelTo(this.trip.path[0]);
	}
};

/**
 * Stop the agent where it is along its trip. 
 * @memberof Agent
 * @instance
 */
Agent.pauseTrip = function() {
	this.trip.paused = true;
};

/**
 * Have the agent continue from where it was left off along its trip. 
 * @memberof Agent
 * @instance
 */
Agent.resumeTrip = function() {
	this.trip.paused = false;
};

/**
 * Set the agent to travel to some point on the map.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {LatLng} goal_point - The point to which the agent should travel.
 */
Agent.travelTo = function(goal_point) {
	this.trip.current_point = this.getLatLng(),
	this.trip.goal_point = goal_point,
		
	//Negating so that neg result corresponds to the goal being rightward/above, pos result to it being leftward/below.
	this.trip.lat_dir = Math.sign(- (this.trip.current_point.lat - this.trip.goal_point.lat)),
	this.trip.lng_dir = Math.sign(- (this.trip.current_point.lng - this.trip.goal_point.lng)),
		
	this.trip.angle = bearing(L.A.pointToCoordinateArray(this.trip.current_point), L.A.pointToCoordinateArray(this.trip.goal_point));
	this.trip.slope = Math.abs((this.trip.current_point.lat - this.trip.goal_point.lat) / (this.trip.current_point.lng - this.trip.goal_point.lng));
	this.trip.speed = this.trip.goal_point.speed;
	
	//If the agent won't be at any particular place at least until it reaches its next goal, mark its place as unanchored.
	if (this.trip.path[0].new_place.type === "unanchored" || this.trip.path[0].move_directly === true) {
		this.place = {type: "unanchored"};	
	}
};

/**
 * Given the agent's currently scheduledthis.trips (its path), get the place from which a newthis.trip should start (namely, the end of the current path).
 * That is: If there's already a path in queue, start the new path from the end of the existing one.
 * @memberof Agent
 * @instance
 * @private
 *
 * @returns {Place} - The place where a newthis.trip should start.
 */
Agent.newTripStartPlace = function() {
	if (this.trip.path.length === 0) { 
		start_place = this.place;
	}
	else {
		start_place = this.trip.path[this.trip.path.length - 1].new_place;
	}

	return start_place;
}

/**
 * Schedule the agent to travel to a point within the unit he is in.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {LatLng} goal_lat_lng - LatLng coordinate object for a point in the same unit the agent is in.
 * @param {number} speed - The speed that the agent should travel, in meters per tick.
 */
Agent.setTravelInUnit = function(goal_lat_lng, goal_place, speed) {
	goal_lat_lng.new_place = goal_place,
	goal_lat_lng.speed = speed;
	this.trip.path.push(goal_lat_lng);
};

/**
 * Schedule the agent to travel directly from any point (e.g. of a street or unit) to a point (e.g. of another street or unit).
 * @name scheduleTrip
 * @memberof Agent
 * @instance
 *
 * @param {LatLng} goal_lat_lng - The point within the place to which the agent is to travel.
 * @param {Place} goal_place - The place to which the agent will travel.
 * @param {number} [speed=1] - The speed in meters per tick that the agent should try to travel. Must be >= .1.
 * @param {Boolean} [move_directly=false] - Whether to ignore the streets & roads and move directly to the goal.
 * @param {Boolean} [replace_trip=false] - Whether to empty the currently scheduled path and replace it with this new trip; false by default (the new trip is
 * simply appended to the current scheduled path).
 */
Agent.setTravelToPlace = function(goal_lat_lng, goal_place, speed = 1, move_directly = false, replace_trip = false) {
	this.checkSpeed(speed);
	
	let start_place = this.newTripStartPlace();
	goal_lat_lng = L.latLng(goal_lat_lng);
	
	if (replace_trip === true) {
		start_place = this.place;
		this.resetTrip();
	}

	//If either the agent is already unanchored or its goal is unanchored, just schedule it to move directly to its goal.
	if (start_place.type === "unanchored" || goal_place.type === "unanchored" || move_directly === true) {
		let goal = goal_lat_lng;
		goal.new_place = goal_place,
		goal.move_directly = true,
		goal.speed = speed;

		this.trip.path.push(goal);

		return;
	}
	
	let goal_layer = this.agentmap.units.getLayer(goal_place.id) || this.agentmap.streets.getLayer(goal_place.id);
	
	//If the goal isn't unanchored, see if it's a street or a unit and schedule the agent appropriately.
	if (goal_layer) {
		let goal_coords = L.A.pointToCoordinateArray(goal_lat_lng);
		
		//Buffering so that points on the perimeter, like the door, are captured. 
		//Also expands street lines into thin polygons (booleanPointInPolygon requires polys).
		//Might be more efficient to generate the door so that it's slightly inside the area.
		let goal_polygon = buffer(goal_layer.toGeoJSON(), .001);
		
		if (booleanPointInPolygon(goal_coords, goal_polygon)) {
			if (start_place.type === "unit" && goal_place.type === "unit" && start_place.id === goal_place.id) {
				this.setTravelInUnit(goal_lat_lng, goal_place, speed);
				return;
			}
			//Move to the street if it's starting at a unit and its goal is elsewhere.
			else if (start_place.type === "unit") {
				let start_unit_door = this.agentmap.getUnitDoor(start_place.id);
				start_unit_door.new_place = start_place,
				start_unit_door.speed = speed;
				this.trip.path.push(start_unit_door);	
				
				let start_unit_street_id = this.agentmap.units.getLayer(start_place.id).street_id,
				start_unit_street_point = this.agentmap.getStreetNearDoor(start_place.id);
				start_unit_street_point.new_place = { type: "street", id: start_unit_street_id },
				start_unit_street_point.speed = speed;
				this.trip.path.push(start_unit_street_point);
			}
			
			if (goal_place.type === "unit") {
				let goal_street_point = this.agentmap.getStreetNearDoor(goal_place.id),
				goal_street_point_place = { type: "street", id: this.agentmap.units.getLayer(goal_place.id).street_id };
				
				//Move to the point on the street closest to the goal unit...
				this.setTravelAlongStreet(goal_street_point, goal_street_point_place, speed);

				//Move from that point into the unit.
				let goal_door = this.agentmap.getUnitDoor(goal_place.id);
				goal_door.new_place = goal_place,
				goal_door.speed = speed;
				this.trip.path.push(goal_door)
				this.setTravelInUnit(goal_lat_lng, goal_place, speed);
			}
			else if (goal_place.street === "number") {
				this.setTravelAlongStreet(goal_lat_lng, goal_place, speed);
			}
		}
		else {
			throw new Error("The goal_lat_lng is not inside of the polygon of the goal_place!");
		}
	}
	else {
		throw new Error("No place exists matching the specified goal_place!");
	}
};

Agent.scheduleTrip = Agent.setTravelToPlace;

/**
 * Schedule the agent to travel to a point along the streets, via streets.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {LatLng} goal_lat_lng - The coordinates of a point on a street to which the agent should travel.
 * @param {Place} goal_place - The place to which the agent will travel. Must be a street.
 * @param {number} speed - The speed that the agent should travel, in meters per tick.
 */
Agent.setTravelAlongStreet = function(goal_lat_lng, goal_place, speed) {
	let goal_coords,
	goal_street_id,
	goal_street_point, 
	goal_street_feature,
	start_place = this.newTripStartPlace(),
	start_street_id,
	start_street_point,
	start_street_feature;
	
	if (start_place.type === "street" && goal_place.type === "street") {
		start_street_id = start_place.id,
		start_street_point = this.trip.path.length !== 0 ? 
			this.trip.path[this.trip.path.length - 1] :
			this.getLatLng();
		start_street_point.new_place = {type: "street", id: start_street_id};

		goal_street_id = goal_place.id,
		goal_street_feature = this.agentmap.streets.getLayer(goal_street_id).feature,
		goal_coords = L.A.pointToCoordinateArray(goal_lat_lng),
		goal_street_point = L.latLng(nearestPointOnLine(goal_street_feature, goal_coords).geometry.coordinates.reverse());
		goal_street_point.new_place = goal_place;
	}
	else {
		throw new Error("Both the start and end places must be streets!");
	}
	
	if (start_street_id === goal_street_id) {
		this.setTravelOnSameStreet(start_street_point, goal_street_point, goal_street_feature, goal_street_id, speed);
	}
	//If the start and end points are on different streets, move from the start to its nearest intersection, then from there
	//to the intersection nearest to the end, and finally to the end.
	else {
		let start_nearest_intersection = this.agentmap.getNearestIntersection(start_street_point, start_place),
		goal_nearest_intersection = this.agentmap.getNearestIntersection(goal_street_point, goal_place);
		
		start_street_feature = this.agentmap.streets.getLayer(start_street_id).feature;
	
		this.setTravelOnStreetNetwork(start_street_point, goal_street_point, start_nearest_intersection, goal_nearest_intersection, speed);
	}
};

/**
 * Schedule the agent to travel between two points on the same street.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param start_lat_lng {LatLng} - The coordinates of the point on the street from which the agent will be traveling.
 * @param goal_lat_lng {LatLng} - The coordinates of the point on the street to which the agent should travel.
 * @param street_feature {Feature} - A GeoJSON object representing an OpenStreetMap street.
 * @param street_id {number} - The ID of the street in the streets layerGroup.
 * @param {number} speed - The speed that the agent should travel, in meters per tick.
 */
Agent.setTravelOnSameStreet = function(start_lat_lng, goal_lat_lng, street_feature, street_id, speed) {
	//lineSlice, regardless of the specified starting point, will give a segment with the same coordinate order 
	//as the original lineString array. So, if the goal point comes earlier in the array (e.g. it's on the far left),
	//it'll end up being the first point in the path, instead of the last, and the agent will move to it directly,
	//ignoring the street points that should come before it. It would then travel along the street from the goal point 
	//to its original point (backwards).
	//To fix this, I'm reversing the order of the coordinates in the segment if the last point in the line is closer
	//to the agent's starting point than the first point on the line (implying the last point in the array is the starting 
	//point, not the goal). 
	
	let start_coords = L.A.pointToCoordinateArray(start_lat_lng),
	goal_coords = L.A.pointToCoordinateArray(goal_lat_lng),
	street_path_unordered = L.A.reversedCoordinates(lineSlice(start_coords, goal_coords, street_feature).geometry.coordinates);
	let start_to_path_beginning = start_lat_lng.distanceTo(L.latLng(street_path_unordered[0])),
	start_to_path_end = start_lat_lng.distanceTo(L.latLng(street_path_unordered[street_path_unordered.length - 1]));
	let street_path = start_to_path_beginning < start_to_path_end ?	street_path_unordered :	street_path_unordered.reverse();
	let street_path_lat_lngs = street_path.map(coords => { 
		let lat_lng = L.latLng(coords);
		lat_lng.new_place = { type: "street", id: street_id },
		lat_lng.speed = speed;

		return lat_lng;
	});

	let first_lat = street_path_lat_lngs[0].lat,
	first_lng = street_path_lat_lngs[0].lng; 

	//Exclude the last point if it's the same as the second to last point of this proposed segment,
	//and the second of it's the same as the first.
	//(since lineSlice adds a point for each other street in an intersection).
	if (street_path_lat_lngs.length > 1) {
		let second_lat = street_path_lat_lngs[1].lat,
		second_lng = street_path_lat_lngs[1].lng, 
		final_lat = street_path_lat_lngs[street_path_lat_lngs.length - 1].lat,
		final_lng = street_path_lat_lngs[street_path_lat_lngs.length - 1].lng,
		penultimate_lat = street_path_lat_lngs[street_path_lat_lngs.length - 2].lat,
		penultimate_lng = street_path_lat_lngs[street_path_lat_lngs.length - 2].lng;
		
		if (first_lat === second_lat && first_lng === second_lng) {
			street_path_lat_lngs.shift();
		}

		if (final_lat === penultimate_lat && final_lng === penultimate_lng) {
			street_path_lat_lngs.pop();
		}
	}
	
	//Exclude the first point if it's already the last point of the already scheduled path.
	if (this.trip.path.length > 0) {
		let prev_lat = this.trip.path[this.trip.path.length - 1].lat,
		prev_lng = this.trip.path[this.trip.path.length - 1].lng;

		if (prev_lat === first_lat && prev_lng === first_lng) {
			street_path_lat_lngs.shift();
		}
	}
		
	this.trip.path.push(...street_path_lat_lngs);
}

/**
 * Schedule the agent up to travel between two points on a street network.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {LatLng} start_lat_lng - The coordinates of the point on the street from which the agent will be traveling.
 * @param {LatLng} goal_lat_lng - The coordinates of the point on the street to which the agent should travel.
 * @param {LatLng} start_int_lat_lng - The coordinates of the nearest intersection on the same street at the start_lat_lng.
 * @param {LatLng} goal_int_lat_lng - The coordinates of the nearest intersection on the same street as the goal_lat_lng.
 * @param {number} speed - The speed that the agent should travel, in meters per tick.
 */
Agent.setTravelOnStreetNetwork = function(start_lat_lng, goal_lat_lng, start_int_lat_lng, goal_int_lat_lng, speed) {
	let path = this.agentmap.getPath(start_int_lat_lng, goal_int_lat_lng, start_lat_lng, goal_lat_lng, true);

	for (let i = 0; i <= path.length - 2; i++) {
		let current_street_id = path[i].new_place.id,
		current_street_feature = this.agentmap.streets.getLayer(current_street_id).feature;
		
		this.setTravelOnSameStreet(path[i], path[i + 1], current_street_feature, current_street_id, speed);			
	}
}

/**
 * Set a new, constant speed for the agent to move along its currently scheduled path.
 * @memberof Agent
 * @instance
 *
 * @param {number} speed - The speed (in meters per tick) that the agent should move. Must be >= .1.
 */
Agent.setSpeed = function(speed) {
	this.checkSpeed(speed); 

	if (this.trip.goal_point !== null) {
		this.trip.speed = speed;
	}

	for (let spot of this.trip.path) {
		this.trip.speed = speed;
		spot.speed = speed;
	}
}

/**
 * Multiply the speed the agent moves along its currently scheduled path by a constant.
 * @memberof Agent
 * @instance
 *
 * @param {number} multiplier - The number to multiply the agent's scheduled speed by. 
 * All scheduled speeds must be >= .1.
 */
Agent.multiplySpeed = function(multiplier) {
	if (this.trip.goal_point !== null) {
		this.trip.speed *= multiplier;
		this.checkSpeed(this.trip.speed);
	}
	
	for (let spot of this.trip.path) {
		spot.speed *= multiplier;
		this.checkSpeed(spot.speed);
	}
}

/**
 * Increase the speed the agent moves along its currently scheduled path by a constant.
 * @memberof Agent
 * @instance
 *
 * @param {number} magnitude - The number to add to the agent's scheduled speed.
 * All scheduled speeds must be >= .1
 */
Agent.increaseSpeed = function(magnitude) {
	if (this.trip.goal_point !== null) {
		this.trip.speed += magnitude;
		this.checkSpeed(this.trip.speed);
	}
	
	for (let spot of this.trip.path) {
		spot.speed += magnitude;
		this.checkSpeed(spot.speed);
	}
}

/**
 * Check whether a given speed is greater than the minimum.
 * @memberof Agent
 * @instance
 *
 * @param {number} speed - A number representing the speed of an agent in meters per second.
 */
Agent.checkSpeed = function(speed) {
	if (speed < .1) {
		throw new Error("Cannot assign speed below .1 to agent!");
	}
}

/**
 * Continue to move the agent directly along the points in its path, at approximately the speed associated with each point in the path.
 * Since two points along the path may be far apart, the agent will make multiple intermediary movements too, splitting up its transfer
 * from its current point to its goal point into a sub-path with multiple sub-goals.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {number} override_speed - Have the agent step this distance, instead of the distance suggested by the current state's speed property.
 */
Agent.travel = function(override_speed) {
	let current_coords = L.A.pointToCoordinateArray(this.trip.current_point),
	sub_goal_distance = override_speed ||this.trip.speed,
	sub_goal_coords = destination(current_coords, sub_goal_distance * .001,this.trip.angle).geometry.coordinates,
	sub_goal_lat_lng = L.latLng(L.A.reversedCoordinates(sub_goal_coords));

	let segment_to_goal = lineString([this.trip.current_point, this.trip.goal_point].map(point => L.A.pointToCoordinateArray(point))),
	segment_to_sub_goal = lineString([this.trip.current_point, sub_goal_lat_lng].map(point => L.A.pointToCoordinateArray(point)));
	
	let goal_lat_dist = Math.abs(this.trip.current_point.lat - this.trip.goal_point.lat),
	goal_lng_dist = Math.abs(this.trip.current_point.lng - this.trip.goal_point.lng);
	
	let dist_to_goal = length(segment_to_goal) * 1000,
	dist_to_sub_goal = length(segment_to_sub_goal) * 1000,
	leftover_after_goal;
	
	//Check if the distance to the sub_goal is greater than the distance to the goal, and if so, make the sub_goal equal the goal
	//and change the number of meters to the sub_goal to the number of meters to the goal.
	if (dist_to_goal < dist_to_sub_goal) {
		sub_goal_lat_lng = this.trip.goal_point,
		sub_goal_distance = dist_to_goal,
		leftover_after_goal = dist_to_sub_goal - dist_to_goal;
	}
	
	if (this.checkArrival(sub_goal_lat_lng, leftover_after_goal)) {
		return;
	}
	
	//Lat/Lng distance between current point and sub_goal point.
	let sub_goal_lat_dist = Math.abs(sub_goal_lat_lng.lat - this.trip.current_point.lat),
	sub_goal_lng_dist = Math.abs(sub_goal_lat_lng.lng - this.trip.current_point.lng);
	
	let half_meters = sub_goal_distance * 2,
	int_half_meters = Math.floor(half_meters),
	int_lat_step_value = this.trip.lat_dir * (sub_goal_lat_dist / half_meters),
	int_lng_step_value = this.trip.lng_dir * (sub_goal_lng_dist / half_meters),
	final_lat_step_value = this.trip.lat_dir * (sub_goal_lat_dist - Math.abs(int_lat_step_value * int_half_meters)),
	final_lng_step_value = this.trip.lng_dir * (sub_goal_lng_dist - Math.abs(int_lng_step_value * int_half_meters));
	
	//Intermediary movements.
	for (let i = 0; i < int_half_meters; ++i) {
		this.step(int_lat_step_value, int_lng_step_value);	
			
		//If the agent is moving directly from a large distance, redirect it back towards the goal if it appears off course.
		if (this.trip.goal_point.move_directly === true) {
			let new_goal_lat_dist = Math.abs(this.trip.current_point.lat - this.trip.goal_point.lat),
			new_goal_lng_dist = Math.abs(this.trip.current_point.lng - this.trip.goal_point.lng);

			if (new_goal_lat_dist > goal_lat_dist || new_goal_lng_dist > goal_lng_dist) {
				this.travelTo(this.trip.goal_point);
			}
		}
		
		if (this.checkArrival(sub_goal_lat_lng, leftover_after_goal)) {
			return;
		}
	}
	
	//Last movement after intermediary movements.
	this.step(final_lat_step_value, final_lng_step_value, true);
		
	if (this.checkArrival(sub_goal_lat_lng, leftover_after_goal)) {
		return;
	}
};

/** 
 * Move the agent a given latitude and longitude.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {number} lat_step_value - The number to add to the agent's latitude.
 * @param {number} lng_step_value - The number to add to the agent's longitude.
 */
Agent.step = function(lat_step_value, lng_step_value) {
	let new_lat_lng = L.latLng([this.trip.current_point.lat + lat_step_value, this.trip.current_point.lng + lng_step_value]);
	
	this.trip.current_point = new_lat_lng,
	this.steps_made++;

	//Only redraw the Agent's position if the number of steps the agent has moved is a multiple of the agentmap.animation_interval.
	if (this.agentmap.animation_interval > 0 && this.steps_made % this.agentmap.animation_interval === 0) {
		this.setLatLng(new_lat_lng);
	} 
	else {
		this._latlng = new_lat_lng;
	}
};

/**
 * Check if the agent has arrived at the next goal in its path or to a sub_goal along the way and perform appropriate arrival operations.
 * @memberof Agent
 * @instance
 * @private
 *
 * @param {LatLng} sub_goal_lat_lng - A sub_goal on the way to the goal (possibly the goal itself).
 * @param {number} leftover_after_goal - If the agent arrives at its goal during the tick, the number of meters, according to its speed,
 * leftover beyond the goal that it should still move during the tick.
 */
Agent.checkArrival = function(sub_goal_lat_lng, leftover_after_goal) {
	if (this.trip.goal_point.distanceTo(this.trip.current_point) < .1) {
		this.place = this.trip.path[0].new_place;
		arrived = true; 

		this.trip.path.shift();
		
		if (this.trip.path.length === 0) {
			this.resetTrip();
		}
		else {
			this.travelTo(this.trip.path[0]);
			
			//If it still needs to move a certain distance during this tick, move it that distance towards the next goal before returning.
			if (leftover_after_goal > 0) {
				this.travel(leftover_after_goal);		
			}
		}
		
		this.trip.moving = false;

		return true;
	}
	else if (sub_goal_lat_lng.distanceTo(this.trip.current_point) < .1) {
		this.trip.moving = false;
		
		return true;
	}
};

/**
 * Make the agent proceed along its trip.
 * @memberof Agent
 * @instance
 */
Agent.moveIt = function() {
	//Make sure the agent isn't paused or already moving.
	if (!this.trip.paused && !this.trip.moving) {
		//Call the agent's fine_controller before it begins moving.
		this.fine_controller();
		
		//Check if the agent has a goal point, and if so travel towards it.
		if (this.trip.goal_point !== null) {
			this.trip.moving = true; 
			this.travel();
		}
		//Otherwise, if there's a scheduled path that the agent hasn't started traveling on yet,
		//start traveling on it.
		else if (this.trip.path.length !== 0) {
			this.trip.moving = true; 
			this.startTrip();
			this.travel();
		}
	}
}

Agent = L.CircleMarker.extend(Agent);

/**
 * Returns an agent object.
 *
 * @param {LatLng} lat_lng - A pair of coordinates to locate the agent at.
 * @param {Object} options - An array of options for the agent, namely its layer.
 * @param {Agentmap} agentmap - The agentmap instance in which the agent exists.
 */
function agent(lat_lng, options, agentmap) {
	return new Agent(lat_lng, options, agentmap);
}

/**
 * A user-defined callback function that returns a feature with appropriate geometry and properties to represent an agent.
 *
 * @callback agentFeatureMaker
 * @param {number} id - The agent's Leaflet layer ID.
 * @returns {Point} - A GeoJSON Point object with geometry and other properties for the agent, including
 * a "place" property that will set the agent's initial {@link Place} and a "layer_options" property
 * that will specify the feature's Leaflet options (like its color, size, etc.). All other provided properties 
 * will be transferred to the Agent object once it is created.
 * See {@link https://leafletjs.com/reference-1.3.2.html#circlemarker} for all possible layer options.
 *
 * @example
 * let point = {					
 * 	"type": "Feature",				 
 * 	"properties": {					
 * 		"layer_options": {			
 * 			"color": "red",			
 * 			"radius": .5,			
 * 		},					
 * 		"place": {				
 * 			"type": "unit",			
 * 			"id": 89			
 * 		},					
 * 							
 * 		age: 72,				
 * 		home_city: "LA"				
 * 	},						
 * 	"geometry" {					
 * 		"type": "Point",			
 * 		"coordinates": [			
 * 			14.54589,			
 * 			57.136239			
 * 		]					
 * 	}						
 * }							
 */

/**
 * A standard {@link agentFeatureMaker}, which sets an agent's location to be the point near the center of the iᵗʰ unit of the map,
 * its place property to be that unit's, and its layer_options to be red and of radius .5 meters.
 * @memberof Agentmap
 * @instance
 * @type {agentFeatureMaker}
 */
function seqUnitAgentMaker(id){
	let index = this.agents.count();

	if (index > this.units.getLayers().length - 1) {
		throw new Error("seqUnitAgentMaker cannot accommodate more agents than there are units.");
	}
	
	let unit = this.units.getLayers()[index],
	unit_id = this.units.getLayerId(unit),
	center_point = centroid(unit.feature);
	center_point.properties.place = {"type": "unit", "id": unit_id},
	center_point.properties.layer_options = {radius: .5, color: "red", fillColor: "red"}; 
	
	return center_point;
}

/**
 * Generate some number of agents and place them on the map.
 * @memberof Agentmap
 * @instance
 *
 * @param {number} count - The desired number of agents.
 * @param {agentFeatureMaker} agentFeatureMaker - A callback that determines an agent i's feature properties and geometry (always a Point).
 */
function agentify(count, agentFeatureMaker) {
	let agentmap = this;

	if (!(this.agents instanceof L.LayerGroup)) {
		this.agents = L.featureGroup().addTo(this.map);
	}

	let agents_existing = agentmap.agents.getLayers().length;
	for (let i = agents_existing; i < agents_existing + count; i++) {
		let new_agent = agent(null, null, agentmap);
		
		//Callback function aren't automatically bound to the agentmap.
		let boundFeatureMaker = agentFeatureMaker.bind(agentmap),
		agent_feature = boundFeatureMaker(new_agent._leaflet_id);
		
		let coordinates = L.A.reversedCoordinates(agent_feature.geometry.coordinates),
		place = agent_feature.properties.place,
		layer_options = agent_feature.properties.layer_options;
		
		//Make sure the agent feature is valid and has everything we need.
		if (!L.A.isPointCoordinates(coordinates)) {
			throw new Error("Invalid feature returned from agentFeatureMaker: geometry.coordinates must be a 2-element array of numbers.");	
		}
		else if (typeof(place.id) !== "number") {
			throw new Error("Invalid feature returned from agentFeatureMaker: properties.place must be a {unit: unit_id} or {street: street_id} with an existing layer's ID.");	
		}

		new_agent.setLatLng(coordinates);
		new_agent.setStyle(layer_options);
		
		delete agent_feature.properties.layer_options;
		Object.assign(new_agent, agent_feature.properties);
		
		this.agents.addLayer(new_agent);
	}
}

Agentmap.prototype.agent = agent,
Agentmap.prototype.agentify = agentify,
Agentmap.prototype.seqUnitAgentMaker = seqUnitAgentMaker;

exports.Agent = Agent,
exports.agent = agent;
