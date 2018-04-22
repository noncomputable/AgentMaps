/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map object.
 * @property {object} map - A Leaflet Map object.
 * @property {object} layers - Leaflet layers for units, streets, and agents. 
 * @property {Agent} agents - An array of all agents in the map.
 */
function Agentmap(map) {
	this.map = map;
	this.layers = {
		units: null,
		streets: null,
		agents: L.geoJSON(
				null,
				{
					pointToLayer: function(feature, latlng) {
						return L.circleMarker(latlng, {radius: 1, color: "red", fillColor: "red"});
					}
				}
			).addTo(this.map)
	},
	this.agents = [];
}

Agentmap.prototype.Agent = Agent,
Agentmap.prototype.agentify = agentify,
Agentmap.prototype.seqUnitAgentMaker = seqUnitAgentMaker,
Agentmap.prototype.mapify = mapify;
