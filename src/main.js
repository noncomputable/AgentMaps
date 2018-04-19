/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map object.
 * @property {object} map - A Leaflet Map object.
 * @property {object} layers - Leaflet layers for units, streets, and agents. 
 */
function Agentmap(map) {
	this.map = map;
	this.layers = {
		units: undefined,
		streets: undefined,
		agents: undefined
	};
};

Agentmap.prototype.agentify = agentify;
Agentmap.prototype.mapify = mapify;

