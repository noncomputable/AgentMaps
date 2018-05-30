(function(A) {
	if (typeof(A) === "undefined") {
		throw new Error("L.A is undefined! Make sure Agentmaps was setup properly in first function of AgentMaps.js (agentmap.js in /src).");
	}

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
		center_point = turf.centroid(unit.feature);
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
			
			let coordinates = A.reversedCoordinates(feature.geometry.coordinates),
			place = feature.properties.place,
			layer_options = feature.properties.layer_options;
			
			//Make sure the agent feature is valid and has everything we need.
			if (!A.isPointCoordinates(coordinates)) {
				throw new Error("Invalid feature returned from agentFeatureMaker: geometry.coordinates must be a 2-element array of numbers.");	
			}
			else if (typeof(place.unit) !== "number" &&
				typeof(place.street) !== "number") {
				throw new Error("Invalid feature returned from agentFeatureMaker: properties.place must be a {unit: unit_id} or {street: street_id} with an existing layer's ID.");	
			}
			
			new_agent = A.agent(coordinates, layer_options, agentmap);
			new_agent.place = place;
			this.agents.addLayer(new_agent);
		}
	}

	/**
	 * The main class representing individual agents, using Leaflet class system.
	 *
	 * @class Agent
	 */
	let Agent = {}

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
	 * Specific methods for traveling between units, within units, and along streets, so as to keep track of where the agent is. Should be used
	 * to move the agent around, not travelTo. If the agent should move in some other way, a wrapper for setTravelTo should be created that
	 * keeps track of the agent's place at any given time accordingly.
	 */

	/**
	 * Given the agent's currently scheduled trips (its path), get the place from which a new trip should start (namely, the end of the current path).
	 * That is: If there's already a path in queue, start the new path from the end of the existing one.
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
	 * Set the agent up to travel to a unit, via streets.
	 *
	 * @param {number} unit_id - The id of the unit to which the agent should travel; unit_id must not be the id of the agent's current place.
	 */
	Agent.setTravelNearUnit = function(unit_id) {
		let start_place = this.newTripStartPlace();
		
		if (start_place.unit === unit_id) {
			return;			
		}

		let street_lat_lng = this.agentmap.getStreetNearDoor(unit_id),
		street_point = A.pointToCoordinateArray(street_lat_lng);

		this.setTravelAlongStreet(null, null, street_point);
	};

	/**
	 * Set the agent up to travel to a point within the unit he is in.
	 *
	 * @param {LatLng} goal_lat_lng - LatLng coordinate object for a point in the same unit the agent is in.
	 */
	Agent.setTravelInUnit = function(goal_lat_lng) {
		let goal_point = A.pointToCoordinateArray(goal_lat_lng),
		//Buffering so that points on the perimeter, like the door, are captured. Might be more
		//efficient to generate the door so that it's slightly inside the area.
		goal_polygon = turf.buffer(this.agentmap.units.getLayer(this.place.unit).toGeoJSON(), .001);
	
		if (turf.booleanPointInPolygon(goal_point, goal_polygon)) {
			point_latLng.new_place = this.place;
			this.travel_state.path.push(point_latLng);
		}
		else {
			throw new Error("The goal_lat_lng is not inside of the polygon of the goal_place!");
		}
	};

	/**
	 * Set the agent up to travel directly from any point (e.g. of a street or unit) to a point (e.g. of another street or unit).
	 *
	 * @param {Object<string, number>} goal_place - The place to which the agent will travel. Must be of form {"unit": unit_id} or {"street": street_id}.
	 * @param {LatLng} goal_lat_lng - The point within the place to which the agent is to travel.
	 */
	Agent.setTravelToPlace = function(goal_place, goal_lat_lng) {
		let goal_layer = this.agentmap.units.getLayer(goal_place.unit) || this.agentmap.streets.getLayer(goal_place.street);

		if (goal_layer) {
			let goal_point = A.pointToCoordinateArray(goal_lat_lng),
			//Buffering so that points on the perimeter, like the door, are captured. Might be more
			//efficient to generate the door so that it's slightly inside the area.
			goal_polygon = turf.buffer(goal_layer.toGeoJSON(), .001);
			if (turf.booleanPointInPolygon(goal_point, goal_polygon)) {
				goal_lat_lng.new_place = goal_place;
				this.travel_state.path.push(goal_lat_lng);
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
	 * Set the agent up to travel to a point along a street, via streets.
	 *
	 * @param {number} goal_street_id - The id of the unit to which the agent should travel; unit_id must not be the id of the agent's current place.
	 * @param {number} distance - The distance into the street that the agent should travel in meters.
	 * @param {LatLng} street_lat_lng - The coordinates of a point on a street to which the agent should travel; null by default, otherwise "distance" will be ignored; if point is provided, street_id is optional; if not provided, it will search through all streets for the point; if provided, it will search that particular street.
	 */
	Agent.setTravelAlongStreet = function(goal_street_id = null, distance = null, street_lat_lng = null) {
		distance *= .001; //Convert to kilometers.

		let start_place = this.newTripStartPlace(),
		street_point = A.pointToCoordinateArray(street_lat_lng),
		street_id,
		next_starting_point;

		if (typeof(start_place.unit) === "number") {
			street_id = this.agentmap.units.getLayer(start_place.unit).street_id;
			
			unit_door = this.agentmap.getUnitDoor(start_place.unit), 
			this.travel_state.path.push(unit_door);	
			
			unit_street_door = this.agentmap.getStreetNearDoor(start_place.unit),
			street_starting_point = A.pointToCoordinateArray(unit_street_door);
		}
		else if (typeof(start_place.street) === "number") {
			street_id = start_place.street,
			current_point = start_place,
			street_starting_point = A.pointToCoordinateArray(current_point);
		}
		
		let street_feature = this.agentmap.streets.getLayer(street_id).feature;

		if (street_point === null) {
			goal_street_point = turf.along(street_feature, distance).geometry.coordinates;
		}
		else {
			goal_street_point = turf.nearestPointOnLine(street_feature, street_point);		
		}
		
		//turf.lineSlice, regardless of the specified starting point, will give a segment with the same coordinate order 
		//as the original lineString array. So, if the goal point comes earlier in the array (e.g. it's on the far left),
		//it'll end up being the first point in the path, instead of the last, and the agent will move to it directly,
		//ignoring the street, and then travel along the street from the goal point to its original point (backwards).
		//To fix this, I'm reversing the order of the coordinates in the segment if the last point in the line is closer
		//to the agent's starting point than the first point on the line (implying it's a situation of the kind described above). 
		let goal_street_line_unordered = turf.lineSlice(street_starting_point, goal_street_point, street_feature).geometry.coordinates,
		goal_street_line = L.latLng(street_starting_point).distanceTo(L.latLng(goal_street_line_unordered[0])) <
			L.latLng(street_starting_point).distanceTo(L.latLng(goal_street_line_unordered[goal_street_line_unordered.length - 1])) ?
			goal_street_line_unordered :
			goal_street_line_unordered.reverse(),
		goal_street_path = goal_street_line.map(point => L.latLng(L.A.reversedCoordinates(point)));
		goal_street_path[0].new_place = {street: street_id},
		goal_street_path[goal_street_path.length - 1].new_place = {street: street_id};
		this.travel_state.path.push(...goal_street_path);
	};

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
	 *
	 * @param {number} rAF_time - The time when the browser's most recent animation frame was released.
	 */
	Agent.update = function(animation_interval, intermediary_interval, steps_inbetween) {
		this.update_func();
		//Set all movement controls and everything else in user-provided update_func; e.g. if (agentmap.ticks % 60 == 0 && this.place.unit == 9) { this.setTravelToUnit(); }
		if (this.travel_state.traveling) {
			this.moveDirectly(animation_interval, intermediary_interval, steps_inbetween);
		}
	}

	function agentFactory(feature, options, agentmap) {
		return new A.Agent(feature, options, agentmap);
	}

	A.Agent = L.CircleMarker.extend(Agent),
	A.agent = agentFactory,
	A.Agentmap.prototype.agentify = agentify,
	A.Agentmap.prototype.seqUnitAgentMaker = seqUnitAgentMaker;
}(L.A));
