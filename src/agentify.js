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
 * @returns {Point} - A GeoJSON Point feature with properties and coordinates for agent i.
 */

/**
 * A standard featureMaker callback, which sets an agent's location as the center of a unit on the map.
 * 
 * @type {agentFeatureMaker}
 */
function seqUnitAgentMaker(i) {
	let unit = i,
	center_point = turf.centroid(Object.values(this.layers.units._layers)[i].feature);
	center_point.properties.unit_id = i;
	
	return center_point;
}

/**
 * Generate some number of agents and place them on the map.
 *
 * @param {number} count - The desired number of agents.
 * @param {agentFeatureMaker} agentFeatureMaker - A callback that determines an agent i's feature properties and geometry (always a Point).
 */
function agentify(count, agentFeatureMaker) {
	let agentmap = this,
	agents_existing = agentmap.agents.length;
	for (let i = agents_existing; i < agents_existing + count; i++) {
		//Callback function aren't automatically bound to the agentmap.
		let boundFeatureMaker = agentFeatureMaker.bind(agentmap),
		feature = boundFeatureMaker(i),
		new_agent = new Agent(feature, i, agentmap);
		this.layers.agents.addData(new_agent.feature, i);
		new_agent.layer = Object.values(agentmap.layers.agents._layers)[new_agent.id];
		this.agents.push(new_agent);
	}
}

/**
 * The main class representing individual agents.
 *
 * @class Agent
 * @param {Point} feature - A GeoJSON point feature representing the agent.
 * @param {number} id - A unique ID for the agent.
 * @param {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {Point} feature - A geoJSON point feature representing the agent.
 * @property {number} feature.AgentMap_id - The agent's instance id, so it can be accessed from inside the Leaflet layer. To avoid putting the actual instance inside the feature object.
 * @property {number} id - A unique ID for the agent.
 * @property {Agentmap} agentmap - The agentmap instance in which the agent exists.
 * @property {object} layer - The layer inside the leaflet map corresponding to this Agent.
 * @property {object} travel_state - Properties detailing information about the agent's trip that change sometimes, but needs to be accessed by future updates.
 * @property {boolean} travel_state.traveling - Whether the agent is currently on a trip.
 * @property {?Point} travel_state.current_point - The point where the agent is currently located.
 * @property {?Point} travel_state.goal_point - The point where the agent is traveling to.
 * @property {?number} travel_state.lat_dir - -1 if traveling to lower latitude (down), 1 if traveling to higher latitude (up).
 * @property {?number} travel_state.lng_dir - -1 if traveling to lesser longitude (left), 1 if traveling to greater longitude (right).
 * @property {?number} travel_state.slope - The slope of the line segment formed by the two points between which the agent is traveling at this time during its trip.
 */
function Agent(feature, id, agentmap) {
	this.feature = feature,
	this.feature.AgentMap_id = id,
	this.id = id,
	this.agentmap = agentmap,
	this.layer = null,
	this.travel_state = {
		traveling: false,
		current_point: null,
		goal_point: null,
		lat_dir: null,
		lng_dir: null,
		slope: null,
	};
}

/**
 * Delete the agent from the AgentMap.
 */	
Agent.prototype.delete = function() {
	delete this.agentmap.agents[this.id];
	this.agentmap.layers.agents.removeLayer(this.layer);
};

/**
 * Stop the agent from traveling, reset all the properties of its travel state.
 */
Agent.prototype.resetTravelState = function() {
	for (let key in this.travel_state) {
		this.travel_state[key] = key != "traveling" ? null : false;
	}
};

/**
 * Set the agent up to travel to some point on the map, via streets.
 *
 * @param {Point} goal_point - The point to which the agent should travel.
 */
Agent.prototype.setTravelTo = function(goal_point) {
	let state = this.travel_state;
	
	state.traveling = true,
	state.current_point = this.layer.getLatLng(),
	state.goal_point = L.latLng(goal_point),
	
	//Negating so that neg result corresponds to the goal being rightward/above, pos result to it being leftward/below.
	state.lat_dir = Math.sign(- (state.current_point.lat - state.goal_point.lat)),
	state.lng_dir = Math.sign(- (state.current_point.lng - state.goal_point.lng)),
	
	state.slope = Math.abs(((state.current_point.lat - state.goal_point.lat) / (state.current_point.lng - state.goal_point.lng)));
};


/**
 * Continue to move the agent directly from one point to another, without regard for streets, 
 * according to the time that has passed since the last movement. Also simulate intermediary movements
 * during the interval between the current call and the last call to moveDirectly, by splitting that interval 
 * up with some precision (agentmap.settings.movement_precision) into some number of parts (steps_inbetween) 
 * and moving slightly for each of them, for more precise collision detection than just doing it after each 
 * call to moveDirectly from requestAnimationFrame (max, 60 times per second) would allow. Limiting movements to
 * each requestAnimationFrame calls was causing each agent to skip too far ahead at each call, causing moveDirectly
 * to not be able to catch when the agent is within 1 meter of the goal_point... making intermediary calls fixes that.
 *
 * @param {number} rAF_time - The time when the browser's most recent animation frame was released.
 */
Agent.prototype.moveDirectly = function(animation_interval, intermediary_interval, steps_inbetween) {
	let state = this.travel_state;
	
	//Fraction of the number of ticks since the last call to move the agent forward by.
	//Only magnitudes smaller than hundredths will be added to the lat/lng at a time, so that it doesn't leap ahead too far;
	//as the tick_interval is usually < 1, and the magnitude will be the leap_fraction multiplied by the tick_interval.
	const leap_fraction = .001;

	let move = (function(tick_interval) {
		if (state.goal_point.distanceTo(state.current_point) < 1) {
			this.resetTravelState();
			return;
		}

		let lat_change = state.lat_dir * state.slope * (leap_fraction * tick_interval),
		lng_change = state.lng_dir * (leap_fraction * tick_interval),
		new_lat_lng = L.latLng([state.current_point.lat + lat_change, state.current_point.lng + lng_change]);
		this.layer.setLatLng(new_lat_lng);
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
Agent.prototype.update = function(animation_interval, intermediary_interval, steps_inbetween) {
	if (this.travel_state.traveling) {
		this.moveDirectly(animation_interval, intermediary_interval, steps_inbetween);
	}
}

/**
 * Get a point through which an agent can exit/enter a unit.
 *
 * @param {number} unit_id - The unique id of the unit whose door you want.
 * @returns {Point} - The center point of the segment of the unit parallel to the street.
 */
function getUnitDoor(unit_id) {
	let unit = Object.values(this.layers.units._layers)[unit_id],
	unit_spec = unit.getLatLngs()[0],
	side_a = unit_spec[0],
	side_b = unit_spec[1],
	door = 	L.latLngBounds(side_a, side_b).getCenter();
	
	return door;
}
