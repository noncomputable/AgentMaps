var agentmap = require('./agentmap');
var agents = require('./agents');
var buildings = require('./buildings');

window.getPathFinder = require("./routing").getPathFinder;
window.getPath = require("./routing").getPath;
window.streetsToGraph = require("./routing").streetsToGraph;
window.decodeCoordString = require("./routing").decodeCoordString;
window.path = require("ngraph.path");
window.createGraph = require("ngraph.graph");

if (typeof(L) === "undefined") {
	throw "L is undefined! Make sure that Leaflet.js is loaded.";
}

L.A = Object.assign({}, agentmap, agents, buildings);
