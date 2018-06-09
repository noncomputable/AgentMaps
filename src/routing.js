//** using shortest path finder, convert OSM geojson data into weighted graph and find the shortest path between two pints **//

var path = require("ngraph.path");
var createGraph = require("ngraph.graph");
var lineSlice = require('@turf/line-slice').default;
var lineDistance = require('@turf/line-distance');

/**
 * Convert street layerGroup to graph.
 *
 */
function streetsToGraph(streets) {
	let graph = createGraph();

	streets.eachLayer(function(street) {
		let street_id = street._leaflet_id,
		cross_indices = [],
		street_points = street.getLatLngs();
		
		//Get the indices for each street of each intersection point involving street
		for (let cross_street in street.intersections) {
			let intersections = street.intersections[cross_street];
			
			for (let intersection of intersections) {
				let intersection_index = intersection[1];
				
				//Ignore duplicates at 3-way intersections.
				if (!cross_indices.some(cross => cross[street_id] === intersection_index[street_id])) {
					cross_indices.push(intersection_index);
				}
			}
		}

		//Sort street's intersection indices
		cross_indices = cross_indices.sort(function(a, b) {
			if (a[street_id] < b[street_id]) {
				return -1;
			}
			if (a[street_id] > b[street_id]) {
				return 1;
			}
			if (a[street_id] === b[street_id]) {
				return 0;
			}
		});

		//Check if beginning and end of street are in the cross_incides, otherwise add them.
		if (!cross_indices.some(cross => cross[street_id] === 0)) {
			let first = {};
			first[street_id] = 0;
			cross_indices.unshift(first);
		}
	
		if (!cross_indices.some(cross => cross[street_id] === street_points.length - 1)) {
			let last = {};
			last[street_id] = street_points.length - 1;
			cross_indices.push(last);
		}

		//Make a graph out of segments of the street between the start, intersections, and end of the street
		//with the coordinates of the start, end, and each intersection being the nodes, and the distance
		//attached to each edge between the nodes as data.
		for (let i = 0; i <= cross_indices.length - 1; i++) {
			if (i <= cross_indices.length - 2) {
				let node_a = street_points[cross_indices[i][street_id]],
				node_b = street_points[cross_indices[i + 1][street_id]],
				a_string = encodeLatLng(node_a),
				b_string = encodeLatLng(node_b),
				start_coords = L.A.pointToCoordinateArray(node_a),
				end_coords = L.A.pointToCoordinateArray(node_b),
				segment = lineSlice(start_coords, end_coords, street.toGeoJSON()),
				distance = lineDistance(segment);
				graph.addLink(a_string, b_string, distance);
			}
		}
	});

	return graph;
}

function getPathFinder(graph) {
	return path.aGreedy(graph, {
		distance(fromNode, toNode, link) {
			return link.data;
		}
	});
}

function getPath(start, end, pathFinder) {
	let start_coord = encodeLatLng(start),
	end_coord = encodeLatLng(end),
	encoded_path = pathFinder.find(start_coord, end_coord),
	path = encoded_path.map(point => decodeCoordString(point.id));

	return path;
}

function encodeLatLng(lat_lng) {
	return lat_lng.lat.toString() + "," + lat_lng.lng.toString();
}

function decodeCoordString(coord_string) {
	let coord_strings = coord_string.split(",");

	return L.latLng(coord_strings);
}

exports.streetsToGraph = streetsToGraph;
exports.getPath = getPath;
exports.getPathFinder = getPathFinder;
exports.decodeCoordString = decodeCoordString;
