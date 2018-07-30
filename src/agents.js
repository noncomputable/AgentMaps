let centroid = require('@turf/centroid').default,
buffer = require('@turf/buffer').default,
booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default,
along = require('@turf/along').default,
nearestPointOnLine = require('@turf/nearest-point-on-line').default,
lineSlice = require('@turf/line-slice').default,
Agentmap = require('./agentmap').Agentmap,
encodeLatLng = require('./routing').encodeLatLng;

/* Here we define agentify, the agent base class, and all other functions and definitions they rely on. */

/**
 * @typedef {Feature} Point
 * @property {Array} geometry.coordinates - This should be a single array with 2 elements: the point's coordinates.
 *
 * An extension of {@link Feature} for points.
 */

/**
 * Callback that gives a feature with appropriate geometry and properties to represent an agent.
 *
 * @callback agentFeatureMaker
 * @param {number} i - A number used to determine the agent's coordinates and other properties.
 * @returns {?Point} - Either a GeoJSON Point feature with properties and coordinates for agent i, including
 * a "place" property that will define the agent's initial agent.place; or null, which will cause agentify
 * to immediately stop its work & terminate.
 */

/**
 * A standard featureMaker callback, which sets an agent's location as the center of a unit on the map.
 * 
 * @type {agentFeatureMaker}
 */
function seqUnitAgentMaker(i){
	if (i > this.units.getLayers().length - 1) {
		return null;
	}
	
	let unit = this.units.getLayers()[i],
	unit_id = this.units.getLayerId(unit),
	center_point = centroid(unit.feature);
	center_point.properties.place = {"unit": unit_id},
	center_point.properties.layer_options = {radius: .5, color: "red", fillColor: "red"}; 
	
	return center_point;
}

/**
 * Generate some number of agents and place them on the map.
 *
 * @param {number} count - The desired number of agents.
 * @param {agentFeatureMaker} agentFeatureMaker - A callback that determines an agent i's feature properties and geometry (always a Point).
 */
function agentify(count, agentFeatureMaker) {
	let agentmap = this;

	if (!(this.agents instanceof L.LayerGroup)) {
		this.agents = L.layerGroup().addTo(this.map);
	}

	let agents_existing = agentmap.agents.getLayers().length;
	for (let i = agents_existing; i < agents_existing + count; i++) {
		//Callback function aren't automatically bound to the agentmap.
		let boundFeatureMaker = agentFeatureMaker.bind(agentmap),
		feature = boundFeatureMaker(i);
		if (feature === null) {
			return;
		}
		
		let coordinates = L.A.reversedCoordinates(feature.geometry.coordinates),
		place = feature.properties.place,
		layer_options = feature.properties.layer_options;
		
		//Make sure the agent feature is valid and has everything we need.
		if (!L.A.isPointCoordinates(coordinates)) {
			throw new Error("Invalid feature returned from agentFeatureMaker: geometry.coordinates must be a 2-element array of numbers.");	
		}
		else if (typeof(place.unit) !== "number" &&
			typeof(place.street) !== "number") {
			throw new Error("Invalid feature returned from agentFeatureMaker: properties.place must be a {unit: unit_id} or {street: street_id} with an existing layer's ID.");	
		}
		
		new_agent = agent(coordinates, layer_options, agentmap);
		new_agent.place = place;
		this.agents.addLayer(new_agent);
	}
}

/**
 * The main class representing individual agents, using Leaflet class system.
 *
 * @class Agent
 */
let Agent = L.Layer.extend({});

/**
 * Constructor for the Agent class, using Leaflet class system.
 *
 * @constructor 
 * @param {Array} latLng - A pair of coordinates to place the agent at.
 * @param {Object} options - An array of options for the agent, namely its layer.
 * @param {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {number} feature.AgentMap_id - The agent's instance id, so it can be accessed from inside the Leaflet layer. To avoid putting the actual instance inside the feature object.
 * @property {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {Object.<string, number>} place - The id of the place (unit, street, etc.) where the agent is currently at.
 * @property {Object} travel_state - Properties detailing information about the agent's trip that change sometimes, but needs to be accessed by future updates.
 * @property {boolean} travel_state.traveling - Whether the agent is currently on a trip.
 * @property {?Point} travel_state.current_point - The point where the agent is currently located.
 * @property {?Point} travel_state.goal_point - The point where the agent is traveling to.
 * @property {?number} travel_state.lat_dir - The latitudinal direction. -1 if traveling to lower latitude (down), 1 if traveling to higher latitude (up).
 * @property {?number} travel_state.lng_dir - The longitudinal direction. -1 if traveling to lesser longitude (left), 1 if traveling to greater longitude (right).
 * @property {?number} travel_state.slope - The slope of the line segment formed by the two points between which the agent is traveling at this time during its trip.
 * @property {Array} travel_state.path - A sequence of LatLngs; the agent will move from one to the next, popping each one off after it arrives until the end of the street; or, until the travel_state is changed/reset.
 * @property {?function} update_func - Function to be called on each update.
 */
Agent.initialize = function(latLng, options, agentmap) {
	this.agentmap = agentmap,
	this.place = null,
	this.travel_state = {
		traveling: false,
		current_point: null,
		goal_point: null,
		lat_dir: null,
		lng_dir: null,
		slope: null,
		path: [],
	};
	this.update_func = function() {};

	L.CircleMarker.prototype.initialize.call(this, latLng, options);
}

/**
 * Stop the agent from traveling, reset all the properties of its travel state.
 * @private
 */
Agent.resetTravelState = function() {
	for (let key in this.travel_state) {
		this.travel_state[key] = 
			key === "traveling" ? false : 
			key === "path" ? [] :
			null;
	}
};

/**
 * Set the agent up to travel to some point on the map.
 * @private
 *
 * @param {latLng} goal_point - The point to which the agent should travel.
 */
Agent.travelTo = function(goal_point) {
	let state = this.travel_state;
	state.traveling = true,
	state.current_point = this.getLatLng(),
	state.goal_point = L.latLng(goal_point),
	
	//Negating so that neg result corresponds to the goal being rightward/above, pos result to it being leftward/below.
	state.lat_dir = Math.sign(- (state.current_point.lat - state.goal_point.lat)),
	state.lng_dir = Math.sign(- (state.current_point.lng - state.goal_point.lng)),
	
	state.slope = Math.abs(((state.current_point.lat - state.goal_point.lat) / (state.current_point.lng - state.goal_point.lng)));
};

/**
 * Start a trip along the path specified in the agent's travel_state.
 * @private
 */
Agent.startTrip = function() {
	if (this.travel_state.path.length > 0) {
		this.travelTo(this.travel_state.path[0]);
	}
	else {
		throw new Error("The travel state's path is empty! There's no path to take a trip along!");
	}
};

/**
 * Given the agent's currently scheduled trips (its path), get the place from which a new trip should start (namely, the end of the current path).
 * That is: If there's already a path in queue, start the new path from the end of the existing one.
 * @private
 */
 Agent.newTripStartPlace = function() {
	if (this.travel_state.path.length === 0) { 
		start_place = this.place;
	}
	else {
		start_place = this.travel_state.path[this.travel_state.path.length - 1].new_place;
	}

	return start_place;
}

/**
 * Set the agent up to travel to a point within the unit he is in.
 * @private
 *
 * @param {LatLng} goal_lat_lng - LatLng coordinate object for a point in the same unit the agent is in.
 */
Agent.setTravelInUnit = function(goal_lat_lng, goal_place) {
	let goal_point = L.A.pointToCoordinateArray(goal_lat_lng),
	//Buffering so that points on the perimeter, like the door, are captured. Might be more
	//efficient to generate the door so that it's slightly inside the area.
	goal_polygon = buffer(this.agentmap.units.getLayer(goal_place.unit).toGeoJSON(), .001);

	if (booleanPointInPolygon(goal_point, goal_polygon)) {
		goal_lat_lng.new_place = this.place;
		this.travel_state.path.push(goal_lat_lng);
	}
	else {
		throw new Error("The goal_lat_lng is not inside of the polygon of the goal_place!");
	}
};

/**
 * Set the agent up to travel directly from any point (e.g. of a street or unit) to a point (e.g. of another street or unit).
 *
 * @param {LatLng} goal_lat_lng - The point within the place to which the agent is to travel.
 * @param {Object<string, number>} goal_place - The place to which the agent will travel. Must be of form {"unit": unit_id} or {"street": street_id}.
 * @param {Boolean} replace_trip - Whether to empty the currently scheduled path and replace it with this new trip; false by default (the new trip is
 * simply appended to the current scheduled path).
 */
Agent.setTravelToPlace = function(goal_lat_lng, goal_place, replace_trip = false) {
	let goal_layer = this.agentmap.units.getLayer(goal_place.unit) || this.agentmap.streets.getLayer(goal_place.street);

	if (goal_layer) {
		let goal_coords = L.A.pointToCoordinateArray(goal_lat_lng);
		
		//Buffering so that points on the perimeter, like the door, are captured. Might be more
		//efficient to generate the door so that it's slightly inside the area.
		let goal_polygon = buffer(goal_layer.toGeoJSON(), .001);
		
		if (booleanPointInPolygon(goal_coords, goal_polygon)) {
			if (replace_trip === true) {
				this.travel_state.path.length = 0;
			}
			
			let start_place = this.newTripStartPlace();
			
			if (start_place.unit === goal_place.unit) {
				this.setTravelInUnit(goal_lat_lng, goal_place);
				return;
			}
			//Move to the street if it's starting at a unit and its goal is elsewhere.
			else if (typeof(start_place.unit) === "number") {
				let start_unit_door = this.agentmap.getUnitDoor(start_place.unit);
				start_unit_door.new_place = start_place;
				this.travel_state.path.push(start_unit_door);	
				
				let start_unit_street_id = this.agentmap.units.getLayer(start_place.unit).street_id,
				start_unit_street_point = this.agentmap.getStreetNearDoor(start_place.unit);
				start_unit_street_point.new_place = { street: start_unit_street_id };
				this.travel_state.path.push(start_unit_street_point);
			}
			
			if (typeof(goal_place.unit) === "number") {
				let goal_street_point = this.agentmap.getStreetNearDoor(goal_place.unit),
				goal_street_point_place = { street: this.agentmap.units.getLayer(goal_place.unit).street_id };
				
				//Move to the point on the street closest to the goal unit...
				this.setTravelAlongStreet(goal_street_point, goal_street_point_place);

				//Move from that point into the unit.
				let goal_door = this.agentmap.getUnitDoor(goal_place.unit);
				goal_door.new_place = goal_place;
				this.travel_state.path.push(goal_door)
				this.setTravelInUnit(goal_lat_lng, goal_place);
			}
			else if (typeof(goal_place.street) === "number") {
				this.setTravelAlongStreet(goal_lat_lng, goal_place);
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

/**
 * Set the agent up to travel to a point along the streets, via streets.
 * @private
 *
 * @param {LatLng} goal_lat_lng - The coordinates of a point on a street to which the agent should travel.
 * @param {Object<string, number>} goal_place - The place to which the agent will travel. Must be of form {"street": street_id}.
 */
Agent.setTravelAlongStreet = function(goal_lat_lng, goal_place) {
	let goal_coords,
	goal_street_id,
	goal_street_point, 
	goal_street_feature,
	start_place = this.newTripStartPlace(),
	start_street_id,
	start_street_point,
	start_street_feature;
	
	if (typeof(start_place.street) === "number" && typeof(goal_place.street) === "number") {
		start_street_id = start_place.street,
		start_street_point = this.travel_state.path[this.travel_state.path.length - 1];
		start_street_point.new_place = {street: start_street_id};

		goal_street_id = goal_place.street,
		goal_street_feature = this.agentmap.streets.getLayer(goal_street_id).feature,
		goal_coords = L.A.pointToCoordinateArray(goal_lat_lng),
		goal_street_point = L.latLng(nearestPointOnLine(goal_street_feature, goal_coords).geometry.coordinates.reverse());
		goal_street_point.new_place = goal_place;
	}
	else {
		throw new Error("Both the start and end places must be streets!");
	}
	
	if (start_street_id === goal_street_id) {
		this.setTravelOnSameStreet(start_street_point, goal_street_point, goal_street_feature, goal_street_id);
	}
	//If the start and end points are on different streets, move from the start to its nearest intersection, then from there
	//to the intersection nearest to the end, and finally to the end.
	else {
		let start_nearest_intersection = this.agentmap.getNearestIntersection(start_street_point, start_place),
		goal_nearest_intersection = this.agentmap.getNearestIntersection(goal_street_point, goal_place);
		
		start_street_feature = this.agentmap.streets.getLayer(start_street_id).feature;
	
		this.setTravelOnStreetNetwork(start_street_point, goal_street_point, start_nearest_intersection, goal_nearest_intersection);
	}
};

/**
 * Set the agent up to travel between two points on the same street.
 * @private
 *
 * @param start_lat_lng {LatLng} - The coordinates of the point on the street from which the agent will be traveling.
 * @param goal_lat_lng {LatLng} - The coordinates of the point on the street to which the agent should travel.
 * @param street_feature {Feature} - A GeoJSON object representing an OpenStreetMap street.
 * @param street_id {number} - The ID of the street in the streets layerGroup.
 */
Agent.setTravelOnSameStreet = function(start_lat_lng, goal_lat_lng, street_feature, street_id) {
	//lineSlice, regardless of the specified starting point, will give a segment with the same coordinate order 
	//as the original lineString array. So, if the goal point comes earlier in the array (e.g. it's on the far left),
	//it'll end up being the first point in the path, instead of the last, and the agent will move to it directly,
	//ignoring the street, and then travel along the street from the goal point to its original point (backwards).
	//To fix this, I'm reversing the order of the coordinates in the segment if the last point in the line is closer
	//to the agent's starting point than the first point on the line (implying it's a situation of the kind described above). 
	
	let start_coords = L.A.pointToCoordinateArray(start_lat_lng),
	goal_coords = L.A.pointToCoordinateArray(goal_lat_lng),
	street_path_unordered = L.A.reversedCoordinates(lineSlice(start_coords, goal_coords, street_feature).geometry.coordinates);
	let start_to_path_beginning = start_lat_lng.distanceTo(L.latLng(street_path_unordered[0])),
	start_to_path_end = start_lat_lng.distanceTo(L.latLng(street_path_unordered[street_path_unordered.length - 1]));
	let street_path = start_to_path_beginning < start_to_path_end ?	street_path_unordered :	street_path_unordered.reverse();
	let street_path_lat_lngs = street_path.map(coords => L.latLng(coords));
	street_path_lat_lngs[0].new_place = { street: street_id },
	this.travel_state.path.push(...street_path_lat_lngs);
}

/**
 * Set the agent up to travel between two points on a street network.
 * @private
 *
 * @param start_lat_lng {LatLng} - The coordinates of the point on the street from which the agent will be traveling.
 * @param goal_lat_lng {LatLng} - The coordinates of the point on the street to which the agent should travel.
 * @param start_int_lat_lng {LatLng} - The coordinates of the nearest intersection on the same street at the start_lat_lng.
 * @param goal_int_lat_lng {LatLng} - The coordinates of the nearest intersection on the same street as the goal_lat_lng.
 */
Agent.setTravelOnStreetNetwork = function(start_lat_lng, goal_lat_lng, start_int_lat_lng, goal_int_lat_lng) {
	let path = this.agentmap.getPath(start_int_lat_lng, goal_int_lat_lng, start_lat_lng, goal_lat_lng, true);

	for (let i = 0; i <= path.length - 2; i++) {
		let current_street_id = path[i].new_place.street,
		current_street_feature = this.agentmap.streets.getLayer(current_street_id).feature;
		
		this.setTravelOnSameStreet(path[i], path[i + 1], current_street_feature, current_street_id);			
	}
}

/**
 * Continue to move the agent directly from one point to another, without regard for streets, 
 * according to the time that has passed since the last movement. Also simulate intermediary movements
 * during the interval between the current call and the last call to moveDirectly, by splitting that interval 
 * up with some precision (agentmap.settings.movement_precision) into some number of parts (steps_inbetween) 
 * and moving slightly for each of them, for more precise collision detection than just doing it after each 
 * call to moveDirectly from requestAnimationFrame (max, 60 times per second) would allow. Limiting movements to
 * each requestAnimationFrame call was causing each agent to skip too far ahead at each call, causing moveDirectly
 * to not be able to catch when the agent is within 1 meter of the goal_point... splitting the interval since the last
 * call up and making intermediary calls fixes that.
 * @private
 *
 * @param {number} rAF_time - The time when the browser's most recent animation frame was released.
 */
Agent.moveDirectly = function(animation_interval, intermediary_interval, steps_inbetween) {
	let state = this.travel_state;
	
	//Fraction of the number of ticks since the last call to move the agent forward by.
	//Only magnitudes smaller than hundredths will be added to the lat/lng at a time, so that it doesn't leap ahead too far;
	//as the tick_interval is usually < 1, and the magnitude will be the leap_fraction multiplied by the tick_interval.
	const leap_fraction = .0001;
	
	let move = (function(tick_interval) {
		if (state.goal_point.distanceTo(state.current_point) < 1) {
			if (typeof(state.path[0].new_place) === "object") {
				this.place = state.path[0].new_place;
			}	
			
			state.path.shift();
			
			if (state.path.length === 0) {
				this.resetTravelState();
				return;
			}
			else {
				this.travelTo(state.path[0]);
			}
		}

		let lat_change = state.lat_dir * state.slope * (leap_fraction * tick_interval),
		lng_change = state.lng_dir * (leap_fraction * tick_interval),
		new_lat_lng = L.latLng([state.current_point.lat + lat_change, state.current_point.lng + lng_change]);
		this.setLatLng(new_lat_lng);
		state.current_point = new_lat_lng;
	}).bind(this);
	
	//Intermediary movements.
	for (let i = 0; i < steps_inbetween; ++i) {
		move(intermediary_interval);
		if (state.traveling === false) {
			return;
		}
	}
	
	//Latest requested movement.
	if (state.traveling === true) {
		//why is this lynchpin
		latest_interval = animation_interval - (this.agentmap.settings.movement_precision * steps_inbetween);
		move(latest_interval);
	}
	else {
		return;
	}
};

/**
 * Make the agent proceed with whatever it's doing and update its properties before the browser draws the next frame.
 * @private
 *
 * @param {number} rAF_time - The time when the browser's most recent animation frame was released.
 */
Agent.update = function(animation_interval, intermediary_interval, steps_inbetween) {
	this.update_func();
	
	if (this.travel_state.traveling) {
		this.moveDirectly(animation_interval, intermediary_interval, steps_inbetween);
	}
}

/**
 * Returns an agent object.
 */
function agent(feature, options, agentmap) {
	return new L.A.Agent(feature, options, agentmap);
}

Agentmap.prototype.agentify = agentify,
Agentmap.prototype.seqUnitAgentMaker = seqUnitAgentMaker;

exports.Agent = L.CircleMarker.extend(Agent),
exports.agent = agent;
