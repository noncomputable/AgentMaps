//** Convert OSM geojson data into a distance-weighted graph and find the shortest path between two points. **//

let path = require("ngraph.path"),
createGraph = require("ngraph.graph"),
lineSlice = require('@turf/line-slice').default,
lineDistance = require('@turf/line-distance'),
Agentmap = require('./agentmap').Agentmap;

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

		//Sort the intersection_indices so that they are in order from the start of the street's coordinate array to the end;
		//this is why we're not getting the raw coordinates, but their indices first, so they can be sorted.
		intersection_indices = intersection_indices.sort(function(a, b) {
			return a - b;
		});

		//Check if beginning and end points of the street are in the intersection_incides; if not, add them.
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
			graph.addLink(a_string, b_string, {
				distance: distance,
				place: { street: street_id } 
			});
		}
	});

	return graph;
}

/**
 * Given an OSM street network (graph), return an A* pathfinder that can operate on it.
 * 
 * @param {object} graph - An ngraph graph representing an OSM street network.
 * @returns {object} - An A* pathfinder for the graph.
 */
function getPathFinder(graph) {
	return path.aStar(graph, {
		distance(fromNode, toNode, link) {
			return link.data.distance;
		}
	});
}

/**
 * Get a path between two points on a graph.
 *
 * @param {LatLng} start
 * @param {LatLng} end
 * @param {Boolean} [sparse=false] - Whether to exclude intersections between the first and last along a street-specific path (which are superfluous for extracting the necessary sub-street).
 * @return {Array<Array<number>>} - An array of points along the graph, leading from the start to the end.
 */
function getPath(start, end, start_lat_lng, goal_lat_lng, sparse = false) {
	let start_coord = encodeLatLng(start),
	end_coord = encodeLatLng(end),
	encoded_path = this.pathfinder.find(start_coord, end_coord),
	path = [];
	
	if (encoded_path.length > 0 && decodeCoordString(encoded_path[0].id).distanceTo(start) > 
					decodeCoordString(encoded_path[0].id).distanceTo(end)) {
		encoded_path = encoded_path.reverse();
	}

	
	if (sparse === true && encoded_path.length >= 2) {
		let sparse_path = [], 
		recent_street = null,
		current_street = null;
		
		for (let i = 0; i <= encoded_path.length - 2; i++) {
			current_street = this.streets.graph.getLink(encoded_path[i].id, encoded_path[i + 1].id) ||
				this.streets.graph.getLink(encoded_path[i + 1].id, encoded_path[i].id);
			
			if (recent_street === null || current_street.data.place.street !== recent_street.data.place.street) {
				let decoded_coords = decodeCoordString(encoded_path[i].id, current_street.data.place);
				sparse_path.push(decoded_coords);
			}
			
			//If the last place on the path to the goal is labeled with a different street id than the goal,
			//add it to the sparse path.
			if (i === encoded_path.length - 2 && goal_lat_lng.new_place.unit !== encoded_path[i + 1]) {
				let decoded_coords = decodeCoordString(encoded_path[i + 1].id, current_street.data.place);
				sparse_path.push(decoded_coords);
			}
				
			recent_street = current_street;
		}
			
		path = sparse_path;
	}
	else {
		path = encoded_path.map(point => decodeCoordString(point.id, 0));
	}
	
	path.unshift(start_lat_lng);
	path.push(goal_lat_lng);
	
	//If the goal point lies before the first intersection of the goal street, then the 2nd to last point in the
	//path will have the previous street's id attached to it. If the goal lies on a different street, make
	//sure the 2nd to last point (thei street path intersection point before the goal) has the same street id as the goal.
	if (path[path.length - 2].new_place.street !== goal_lat_lng.new_place.street) {
		path[path.length - 2].new_place = goal_lat_lng.new_place;
	}
	
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
 * @param {object} place - An object specifying the place of the coordinate string.
 * @returns {LatLng} - The coordinates encoded by the coord_string.
 */
function decodeCoordString(coord_string, place) {
	let coord_strings = coord_string.split(","),
	lat_lng = L.latLng(coord_strings);
	lat_lng.new_place = place;

	return lat_lng;
}

Agentmap.prototype.getPath = getPath;

exports.streetsToGraph = streetsToGraph;
exports.getPathFinder = getPathFinder;
exports.encodeLatLng = encodeLatLng;
