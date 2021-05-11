#!/usr/bin/env node

/* This file is part of AgentMaps which is released under the Simplified BSD License. */

/* Core of a command line tool that runs buildingify and exports the resulting street and unit layers. */

let optimist = require("optimist"),
fs = require("fs"),
path = require("path");

//Mock a browser environment.
var window = {
	screen: {}
},
document = {
	documentElement: {
		style: []
	},
	createElement: () => ({
		getContext: null
	}),
},
navigator = { 
	userAgent: {
		toLowerCase: () => ""
	}, 
	platform: "" 
},
requestAnimationFrame = () => null;

//Setup the Leaflet namespace.
let L = require("leaflet");
L.A = require(path.join("..", "src", "utils"));

//Logging functions.
function new_status(text = "") {
	process.stdout.write(text);
}

function status_update(text = "") {
	process.stdout.clearLine();
	process.stdout.write(text);
	process.stdout.cursorTo(0);
}

function end_status() {
	process.stdout.write("\n");
}

//Let other modules access L and the logging functions.
exports.L = L;
exports.new_status = new_status;
exports.status_update = status_update;
exports.end_status = end_status;

//Mock an AgentMaps object.
function AgentMock() {
	this.streets = null;
	this.units = null;
}

let browserlessbuildings = require("./browserlessbuildings");
AgentMock.prototype.buildingify = browserlessbuildings.buildingify;

let agentmock = new AgentMock();

//Accept as input an array specifying the bounding box and
//the name of a file containing the GeoJSON of streets wihin it.
let bounding_box = JSON.parse(optimist.argv["bbox"]),
OSM_file = path.normalize(optimist.argv["streets"]);

fs.readFile(OSM_file, "utf8", function(error, data) {
	readError(error);
	processFile(data)
});

//Given the bounding box and OSM data, extract the necessary info,
//generate the buildings (streets and units), and save them as files.
function processFile(data) {
	let start = data.indexOf("{");
	data = data.slice(start);

	if (data[data.length - 1] !== "}") {
		data = data.slice(0, -1);
	}
	
	let OSM_data = JSON.parse(data);
	
	agentmock.buildingify(bounding_box, OSM_data);
	
	let streets = agentmock.streets.toGeoJSON(20),
	units = agentmock.units.toGeoJSON(20);

	let streets_contents = "var streets_data = " + JSON.stringify(streets) + ";",
	units_contents = "var units_data = " + JSON.stringify(units) + ";";
	
	fs.writeFile("street_features.js", streets_contents, writeError);
	fs.writeFile("unit_features.js", units_contents, writeError);
}

function writeError(error) {
	if (error) {
		let prefix = "There was an issue saving your data: ";
		return console.log(prefix + error);
	}
}

function readError(error) {
	if (error) {
		let prefix = "There was an issue accessing your data: ";
		return console.log(prefix + error);
	}
}
