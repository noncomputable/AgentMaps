/* A few functions that may be useful in other modules. */

/**
 * Given a geoJSON geometry object's coordinates, return the object, but with
 * all the coordinates reversed. <br /point.geometry && point.geometry.coordinates && >
 * 
 * Why? GeoJSON coordinates are in lngLat format by default, while Leaflet uses latLng.
 * L.geoJSON will auto-reverse the order of a GeoJSON object's coordinates, as it
 * expects geoJSON coordinates to be lngLat. However, normal, non-GeoJSON-specific Leaflet
 * methods expect Leaflet's latLng pairs and won't auto-reverse, so we have to do that
 * manually if we're preprocessing the GeoJSON data before passing it to L.geoJSON.
 * 
 * @param {Array<number|Array<number|Array<number>>>} coordinates - GeoJSON coordinates for a point, (multi-)line, or (multi-)polygon.
 * @returns {Array<number|Array<number|Array<number>>>} - Reversed geoJSON coordinates for a point, (multi-)line, or (multi-)polygon.
 */
function reversedCoordinates(coordinates) {
	let reversed = coordinates.slice();
	if (typeof coordinates[0] != "number") {
		for (let inner_coordinates of coordinates) {
			reversed.splice(reversed.indexOf(inner_coordinates), 1, reversedCoordinates(inner_coordinates));
		}
	}
	else {
		reversed = [coordinates[1], coordinates[0]];
	}

	return reversed;
}

/**
 * Given an array, check whether it can represent the coordinates of a point.
 *
 * @param {Array} array - Array to check.
 * @returns {boolean} - Whether the array can be the coordinates of a point.
 */
function isPointCoordinates(array) {
	if (array.length !== 2 && 
		!(typeof(array[0]) == "number" &&
		typeof(array[1]) == "number")) {
		return false;
	}

	return true;
}

/**
 * Given either a GeoJSON feature, L.latLng, or coordinate array containing the coordinates of a point,
 * return an array of the coordinates.
 *
 * @param {Point|Array<number>|LatLng} point - The data containing the point's coordinates (latitude & longitude).
 * @returns {Array<number>} - Array of the point's coordinates. I.e.: [lng, lat].
 */
function pointToCoordinateArray(point) {
	let coordinate_array;

	if (typeof(point.lat) === "number" && typeof(point.lng) === "number") {
		coordinate_array = [point.lng, point.lat];
	}
	else if (point.geometry && point.geometry.coordinates && isPointCoordinates(point.geometry.coordinates)) {
		coordinate_array = point.geometry.coordinates;
	}
	else if (isPointCoordinates(point)) {
		coordinate_array = point;
	}
	else {
		throw new Error("Invalid point: point must either be array of 2 coordinates, or an L.latLng.");
	}

	return coordinate_array;
}

/**
 * Given two coordinate arrays, get their intersections.
 * 
 * @param {array<array<number>>} arr_a - Array of coordinate pairs.
 * @param {array<array<number>>} arr_b - Array of coordinate pairs.
 * @param {array<number>} ids - 2-element array whose elements are IDs for arr_a and arr_b respectively.
 *
 * @returns {Array<Array<number|Object<number, number>>>} - Array whose elements are the intersections' cooridinate-pairs if
 * ids is empty, or otherwise whose elements are arrays each of whose first element is an
 * intersection's coordinate-pair and whose second element is an object mapping each array's ID (supplied by ids) 
 * to the index of the intersection's coordinate-pair in that array.
 */
function getIntersections(arr_a, arr_b, ids = []) {
	let intersections = [];

	for (let i = 0; i < arr_a.length; i++) {
		let el_a = arr_a[i];

		for (let j = 0; j < arr_b.length; j++) {
			let el_b = arr_b[j];
			
			if (isPointCoordinates(el_a) && isPointCoordinates(el_b)) {
				if (el_a[0] === el_b[0] && el_a[1] === el_b[1]) {
					let new_intersection;

					if (ids.length === 2) {
						let identified_intersections = {};
						identified_intersections[ids[0]] = i,
						identified_intersections[ids[1]] = j,
						new_intersection = [el_a, identified_intersections];
					}
					else {
						new_intersection = el_a;
					}
				
					intersections.push(new_intersection);
				}
			}
			else {
				throw new Error("Every element of each array must be a coordinate pair array.");
			}
		}
	}

	return intersections;
}

exports.getIntersections = getIntersections;
exports.reversedCoordinates = reversedCoordinates;
exports.isPointCoordinates = isPointCoordinates;
exports.pointToCoordinateArray = pointToCoordinateArray;
