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
		if (!(this.agents instanceof L.LayerGroup)) {
			this.agents = L.layerGroup().addTo(this.map);
		}

		let agentmap = this,
		agents_existing = agentmap.agents.getLayers().length;
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
	 * @property {Array} travel_state.path - A sequence of pairs of LatLngs, such that the second latLng of a pair is the first latLng of the pair that comes after it. The agent will move between one pair, then the pair will be popped off, then move between the next pair, and so on, until there are no pairs left and the trip along the path is complete; or, until the travel_state is changed/reset.
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
			this.travel_state[key] = key === "traveling" ? false : 
				key === "path" ? [] :
				null;
		}
	};

	/**
	 * Set the agent up to travel to some point on the map.
	 *
	 * @param {latLng} goal_point - The point to which the agent should travel.
	 */
	Agent.setTravelTo = function(goal_point) {
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
	 * Specific methods for traveling between units, within units, and along streets, so as to keep track of where the agent is. Should be used
	 * to move the agent around, not setTravelTo. If the agent should move in some other way, a wrapper for setTravelTo should be created that
	 * keeps track of the agent's place at any given time accordingly.
	 */

	/**
	 * Set the agent up to travel to a unit, via streets.
	 *
	 * @param {number} unit_id - The id of the unit to which the agent should travel; unit_id must not be the id of the agent's current place.
	 */
	Agent.setTravelToUnit = function(unit_id) {
		return;
	};

	/**
	 * Set the agent up to travel to a point within the unit he is in.
	 *
	 * @param {LatLng} point_latLng - LatLng coordinate object for a point in the same unit the agent is in.
	 */
	Agent.setTravelInUnit = function(point_latLng) {
		let point_coordinates = A.pointToCoordinateArray(point_latLng),
		point_feature = turf.point(point_coordinates),
		poly_feature = this.agentmap.units.getLayer(this.place.unit).feature;
	
		//NEED TO GET IT TO CONTAIN THE DOOR
		//if (turf.booleanPointInPolygon(point_feature, poly_feature)) {
			this.setTravelTo(point_latLng);
	//	}
	};

	/**
	 * Set the agent up to travel to a point along a street, via streets.
	 *
	 * @param {number} goal_street_id - The id of the unit to which the agent should travel; unit_id must not be the id of the agent's current place.
	 * @param {number} distance - The distance into the street that the agent should travel.
	 * @param {LatLng} street_point - The coordinates of a point on a street to which the agent should travel; null by default, otherwise "distance" will be ignored; if point is provided, street_id is optional; if not provided, it will search through all streets for the point; if provided, it will search that particular street.
	 */
	Agent.setTravelToStreet = function(street_id, distance, street_point = null) {
		if (street_point === null) {
			let street_id;

			if (typeof(this.place.unit) === "number") {
				street_id = this.agentmap.units.getLayer(this.place.unit).feature.properties.street_id;
				
				let current_coords = this.getLatLng(),
				unit_door = this.agentmap.getUnitDoor(this.place.unit), 
				current_to_door = [current_coords, unit_door],
				unit_street_door = this.agentmap.getStreetNearDoor(this.place.unit),
				door_to_street = [unit_door, unit_street_door];
				this.travel_state.path.push(current_to_door, door_to_street);	
			}
			else {
				street_id = this.place.street;
			}
			let street = this.agentmap.streets.getLayer(street_id);
			console.log(street_id, street, distance);
			goal_street_point = turf.along(street, distance).geometry.coordinates,
			street_segment = [unit_street_door, goal_street_point];
			this.travel_state.path.push(street_segment);
		}
		else {
			return;
		}
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
		const leap_fraction = .001;

		let move = (function(tick_interval) {
			if (state.goal_point.distanceTo(state.current_point) < 1) {
				state.path.shift();
				
				if (state.path.length === 0) {
					this.resetTravelState();
					return;
				}
				else {
					this.setTravelTo(this.getLatLng(), state.path[0][1]);
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
