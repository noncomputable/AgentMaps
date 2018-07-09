//** Convert OSM geojson data into a distance-weighted graph and find the shortest path between two points. **//

var path = require("ngraph.path");
var createGraph = require("ngraph.graph");
var lineSlice = require('@turf/line-slice').default;
var lineDistance = require('@turf/line-distance');

/**
 * Convert a layerGroup of streets into a graph.
 *
 * @param {LayerGroup} streets - A Leaflet layerGroup of streets, forming a street network.
 * @returns {Object} - A graph representing the street network, operable by the ngraph pathfinder. 
 */
function streetsToGraph(streets) {
	let graph = createGraph();

	//For each street, get an array of indices for the start, intersections, and end coordinates, in order from
	//start to end. Then, add the coordinates at each index as a node, and an edge between each adjacent node in the array,
	//associating the distance between the nodes (between their coordinates) with each edge.
	streets.eachLayer(function(street) {
		let street_id = street._leaflet_id,
		intersection_indices = [],
		street_points = street.getLatLngs();
		
		//Populate intersection_indices with the indices of all of the street's intersections in its coordinate array.
		for (let cross_street in street.intersections) {
			let intersections = street.intersections[cross_street];
			
			for (let intersection of intersections) {
				let intersection_index = intersection[1][street_id];
				
				//Ignore duplicate intersection points (caused by 3-way intersections).
				if (!intersection_indices.some(other_intersection_index => other_intersection_index === intersection_index)) {
					intersection_indices.push(intersection_index);
				}
			}
		}

		//Sort the cross_indices so that they are in order from the start of the street's coordinate array to the end.
		intersection_indices = intersection_indices.sort(function(a, b) {
			return a - b;
		});

		//Check if beginning and end of street are in the cross_incides; if not, add them.
		if (!intersection_indices.some(intersection_index => intersection_index === 0)) {
			intersection_indices.unshift(0);
		}
		if (!intersection_indices.some(intersection_index => intersection_index === street_points.length - 1)) {
			intersection_indices.push(street_points.length - 1);
		}

		//Make a graph out of segments of the street between the start, intersections, and end of the street,
		//so that the nodes are the coordinates of the start, end, and intersection points, and the edges are
		//the segments between successive nodes. Each edge is associated with the geographic distance between its nodes.
		for (let i = 0; i <= intersection_indices.length - 2; i++) {
			let node_a = street_points[intersection_indices[i]],
			node_b = street_points[intersection_indices[i + 1]],
			a_string = encodeLatLng(node_a),
			b_string = encodeLatLng(node_b),
			start_coords = L.A.pointToCoordinateArray(node_a),
			end_coords = L.A.pointToCoordinateArray(node_b),
			segment = lineSlice(start_coords, end_coords, street.toGeoJSON()),
			distance = lineDistance(segment);
			graph.addLink(a_string, b_string, distance);
		}
	});

	return graph;
}

/**
 * Given an OSM street network (graph), return a greedy A* pathfinder that can operate on it.
 * 
 * @param {object} graph - An ngraph graph representing an OSM street network.
 * @returns {object} - A greedy A* pathfinder for the graph.
 */
function getPathFinder(graph) {
	return path.aGreedy(graph, {
		distance(fromNode, toNode, link) {
			return link.data;
		}
	});
}

/**
 * Get an approximately shortest path between two points on a graph.
 *
 * @param {LatLng} start
 * @param {LatLng} end
 * @param {Object} pathFinder - The pathfinder associated with a graph which contains the start and end points.
 * @return {Array<Array<number>>} - An array of points along the graph, leading from the start to the end.
 */
function getPath(start, end, pathFinder) {
	let start_coord = encodeLatLng(start),
	end_coord = encodeLatLng(end),
	encoded_path = pathFinder.find(start_coord, end_coord),
	path = encoded_path.map(point => decodeCoordString(point.id));

	return path;
}

/**
 * Turn a LatLng object into a string representing its coordinates (to act as a graph node's ID).
 *
 * @param {LatLng} lat_lng - The coordinates to encode into a string.
 * @returns {string} - A string containing coordinates in the format of "Latitude,Longitude".
 */
function encodeLatLng(lat_lng) {
	return lat_lng.lat.toString() + "," + lat_lng.lng.toString();
}

/**
 * Turn a string containing coordinates (a graph node's ID) into a LatLng object.
 *
 * @param {string} coord_string - A string containing coordinates in the format of "Latitude,Longitude".
 * @returns {LatLng} - The coordinates encoded by the coord_string.
 */
function decodeCoordString(coord_string) {
	let coord_strings = coord_string.split(",");

	return L.latLng(coord_strings);
}

exports.streetsToGraph = streetsToGraph;
exports.getPath = getPath;
exports.getPathFinder = getPathFinder;
