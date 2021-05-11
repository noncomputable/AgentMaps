/* This file is part of AgentMaps which is released under the Simplified BSD License. */

/* Here we have utilities to convert OSM geojson data into a distance-weighted graph and find the shortest path between two points. */

let path = require("ngraph.path"),
createGraph = require("ngraph.graph"),
lineSlice = require('@turf/line-slice').default,
length = require('@turf/length').default,
Agentmap = require('./agentmap').Agentmap;

/**
 * Convert a layerGroup of streets into a graph. Useful if you modify the street layers during the simulation
 * and want routing to work with the new street network.
 *
 * @param {LayerGroup} streets - A Leaflet layerGroup of streets, forming a street network.
 * @returns {Object} - A graph representing the street network, operable by the ngraph pathfinder. 
 */
function streetsToGraph(streets) {
	let graph = createGraph(),
	streetToGraphBound = streetToGraph.bind(this, graph);
	
	//For each street, get an array of indices for the start, intersections, and end coordinates, in order from
	//start to end. Then, add the coordinates at each index as a node, and an edge between each adjacent node in the array,
	//associating the distance between the nodes (between their coordinates) with each edge.
	streets.eachLayer(streetToGraphBound);

	return graph;
}

/**
 * Process a street layer and add it into a graph.
 *
 * @param {ngraph.graph} graph - An ngraph.graph representing a street network.
 * @param {L.Polyline} street - A Leaflet Polyline layer for a street.
 */
function streetToGraph(graph, street) {
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
		distance = length(segment);
		graph.addLink(a_string, b_string, {
			distance: distance,
			place: { type: "street",
				id: street_id } 
		});
	}
}

/**
 * Given a street network (graph), return a pathfinder that can operate on it.
 * Useful if you modify the street graph during the simulation.
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
 * @memberof Agentmap
 * @instance
 * @private
 *
 * @param start_int_lat_lng {LatLng} - The coordinates of the nearest intersection on the same street at the start_lat_lng.
 * @param goal_int_lat_lng {LatLng} - The coordinates of the nearest intersection on the same street as the goal_lat_lng.
 * @param start_lat_lng {LatLng} - The coordinates of the point on the street from which the agent will be traveling.
 * @param goal_lat_lng {LatLng} - The coordinates of the point on the street to which the agent should travel.
 * @param {Boolean} [sparse=false] - Whether to exclude intersections between the first and last along a street-specific path (which are superfluous for extracting the necessary sub-street).
 * @return {Array<Array<number>>} - An array of points along the graph, leading from the start to the end.
 */
function getPath(start_int_lat_lng, goal_int_lat_lng, start_lat_lng, goal_lat_lng, sparse = false) {
	let start_coord = encodeLatLng(start_int_lat_lng),
	end_coord = encodeLatLng(goal_int_lat_lng),
	encoded_path = this.pathfinder.find(start_coord, end_coord),
	path = [];
	
	if (encoded_path.length > 0 && decodeCoordString(encoded_path[0].id).distanceTo(start_int_lat_lng) > 
					decodeCoordString(encoded_path[0].id).distanceTo(goal_int_lat_lng)) {
		encoded_path = encoded_path.reverse();
	}

	if (sparse === true && encoded_path.length >= 2) {
		let sparse_path = [], 
		recent_street = null,
		current_street = null;
		
		for (let i = 0; i <= encoded_path.length - 2; i++) {
			current_street = this.streets.graph.getLink(encoded_path[i].id, encoded_path[i + 1].id) ||
				this.streets.graph.getLink(encoded_path[i + 1].id, encoded_path[i].id);
			
			if (recent_street === null || current_street.data.place.id !== recent_street.data.place.id) {
				let decoded_coords = decodeCoordString(encoded_path[i].id, current_street.data.place);
				sparse_path.push(decoded_coords);
			}
				
			//If the last place on the path to the goal is labeled with a different street id than the goal,
			//add it to the sparse path.	
			if (i === encoded_path.length - 2) {
				let decoded_coords = decodeCoordString(encoded_path[i + 1].id, current_street.data.place);
				sparse_path.push(decoded_coords);
			}
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
	//sure the 2nd to last point (the street path intersection point before the goal) has the same street id as the goal.
	if (path[path.length - 2].new_place.id !== goal_lat_lng.new_place.id) {
		path[path.length - 2].new_place = goal_lat_lng.new_place;
	}

	//If the second [to last] point--namely the intersection closest to the start [goal]--is further from the third
	//[to last] point than the goal, and all three points are on the same street, remove the second [to last] point.
	if (path.length >= 3) {
		checkStartExcess.call(this, path);
		checkEndExcess.call(this, path);
	}
	
	return path;
}

//checkStartExcess and checkEndExcess are _much_ easier to follow given distinct variable names,
//and so they are not abstracted into one more general function.

/** 
 * If the first two points after the start point share the same street as the start point, and the
 * third point is closer to the first (start) point than it is to the second point, remove the 
 * second point, as it's a superfluous detour.<br/><br/>
 *
 * Typically happens when the start point's nearest intersection is beyond it on the street,
 * and so the path would have an agent travel from the start, then to the intersection,
 * then backwards to the third point.
 * @private
 *
 * @param {Array<LatLng>} path - An array of LatLngs representing a path for an agent to travel along.
 */
function checkStartExcess(path) {
	let start_street = this.streets.getLayer(path[0].new_place.id),
	second_street_id = path[1].new_place.id,	
	start_second_intersections = start_street.intersections[second_street_id],
	second_is_intersection = typeof(start_second_intersections) === "undefined" ? false :
		start_second_intersections.some(intersection => 
		intersection[0].lat === path[1].lat && intersection[0].lng === path[1].lng),
	third_street_id = path[2].new_place.id,
	start_third_intersections = start_street.intersections[third_street_id],
	third_is_intersection = typeof(start_third_intersections) === "undefined" ? false :
		start_third_intersections.some(intersection =>
		intersection[0].lat === path[2].lat && intersection[0].lng === path[2].lng);

	if ((second_is_intersection || second_street_id === path[0].new_place.id) && 
		(third_is_intersection || third_street_id === path[0].new_place.id)) {
		if (path[2].distanceTo(path[0]) <
			path[2].distanceTo(path[1])) {
			path.splice(1, 1);
		}
	}
}

/** 
 * If the last two points before the goal point share the same street as the goal point, and the
 * first point is closer to the third (goal) point than it is to the second point, remove the 
 * second point, as it's a superfluous detour.<br/><br/>
 *
 * Typically happens when the goal point's nearest intersection is beyond it on the street,
 * and so the path would have an agent travel from the first point, then to the intersection (second point),
 * then backwards to the (third) goal point.<br/><br/>
 *
 * @private
 *
 * @param {Array<LatLng>} path - An array of LatLngs representing a path for an agent to travel along.
 */
function checkEndExcess(path) {
	let goal_street = this.streets.getLayer(path[path.length - 1].new_place.id),
	second_to_last_street_id = path[path.length - 2].new_place.id,
	goal_second_to_last_intersections = goal_street.intersections[second_to_last_street_id],
	second_to_last_is_intersection = typeof(goal_second_to_last_intersections) === "undefined" ? false :
		goal_second_to_last_intersections.some(intersection => 
		intersection[0].lat === path[path.length - 1].lat && intersection[0].lng === path[path.length - 1].lng),
	third_last_street_id = path[path.length - 3].new_place.id,
	goal_third_last_intersections = goal_street.intersections[third_last_street_id],
	third_last_is_intersection = typeof(goal_third_last_intersections) === "undefined" ? false :
		goal_third_last_intersections.some(intersection =>
		intersection[0].lat === path[path.length - 3].lat && intersection[0].lng === path[path.length - 3].lng);

	if ((second_to_last_is_intersection || second_to_last_street_id === path[path.length - 1].new_place.id) &&
		(third_last_is_intersection || third_last_street_id === path[path.length - 1].new_place.id) && 
		path.length >= 3) {
		if (path[path.length - 3].distanceTo(path[path.length - 1]) <
			path[path.length - 3].distanceTo(path[path.length - 2])) {
			path.splice(path.length - 2, 1);
		}
	}
}

/**
 * Turn a LatLng object into a string representing its coordinates (to act as a graph node's ID).
 * @private
 *
 * @param {LatLng} lat_lng - The coordinates to encode into a string.
 * @returns {string} - A string containing coordinates in the format of "Latitude,Longitude".
 */
function encodeLatLng(lat_lng) {
	return lat_lng.lat.toString() + "," + lat_lng.lng.toString();
}

/**
 * Turn a string containing coordinates (a graph node's ID) into a LatLng object.
 * @private
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
