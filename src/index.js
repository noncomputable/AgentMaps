let agentmap = require('./agentmap'),
agents = require('./agents'),
buildings = require('./buildings'),
utils = require('./utils');

if (typeof(L) === "undefined") {
	throw "L is undefined! Make sure that Leaflet.js is loaded.";
}

L.A = Object.assign({}, agentmap, agents, buildings, utils);
