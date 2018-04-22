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
 * @property {Agent} feature.AgentMap_id - The agent's instance id, so it can be accessed from inside the Leaflet layer. To avoid putting the actual instance inside the feature object.
 * @property {number} id - A unique ID for the agent.
 */
function Agent(feature, id, agentmap) {
	this.feature = feature,
	this.feature.AgentMap_id = id,
	this.id = id,
	this.agentmap = agentmap,
	this.layer = null;
}

/**
 * Delete the agent from the AgentMap
 */
Agent.prototype.delete = function() {
	delete this.agentmap.agents[this.id];
	console.log(this.layer);
	this.agentmap.layers.agents.removeLayer(this.layer);
};
