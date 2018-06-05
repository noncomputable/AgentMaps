var agentmap = require('./agentmap');
var agents = require('./agents');
var buildings = require('./buildings');

if (typeof(L) === "undefined") {
	throw "L is undefined! Make sure that Leaflet.js is loaded.";
}

L.A = Object.assign({}, agentmap, agents, buildings);
