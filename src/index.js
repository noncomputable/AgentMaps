var agentmap = require('./agentmap');
var agents = require('./agents');
var buildings = require('./buildings');

if (typeof(L) === "undefined") {
	throw "L is undefined! Make sure that Leaflet.js is loaded.";
}

console.log("boop");

L.A = Object.assign({}, agentmap, agents, buildings);
