/* Here we define mapify and all other functions and definitions it relies on. */

/**
 * @typedef {object} Feature
 * @property {string} type - Should be Feature.
 * @property {object} properties - Non-geometric properties describing the map feature.
 * @property {object} geometry - Specification of the feature's geometry.
 * @property {string} geometry.type - The feature's GeoJSON geometry type
 * @property {Array} geometry.coordinates - The coordinates specifying the feature's geometry.
 * @see {@link http://geojson.org/}
 */

/**
 * Generate and setup the desired map features (e.g. streets, houses).
 *
 * @param {Array.<Array.<number>>} bounding_box - The map's top-left and bottom-right coordinates.
 * @param {object} OSM_data - A GeoJSON Feature Collection object containing the OSM features inside the bounding box.
 * @param {string} OSM_data_URL - URL from which to download equivalent OSM_data.
 */
function mapify (bounding_box, OSM_data, OSM_data_URL) {
	//if (!GeoJSON_data && GeoJSON_data_URL) {}
	
	let all_features = getAllFeatures(OSM_data, bounding_box);
	
	let unit_options = {
		style: {
			"color": "green",
			"weight": 1,
			"opacity": .87
		}
	};

	let unit_feature_collection = { 
		type: "FeatureCollection", 
		features: all_features.units
	};
	
	this.layers.units = L.geoJSON(
		unit_feature_collection,
		unit_options
	).addTo(this.map);

	let street_options = {
		style: {
			"color": "yellow",
			"weight": 4,
			"opacity": .5
		}
	};

	let street_feature_collection = {
		type: "FeatureCollection",
		features: all_features.streets
	};
	
	this.layers.streets = L.geoJSON(
		street_feature_collection,
		street_options
	).addTo(this.map);
}

/**
 * Generate all appropriate roads and units within the desired bounding box.
 *
 * @param {Object} OSM_data - A GeoJSON Feature Collection object containing the OSM features inside the bounding box.
 * @returns {Object<string, Array<Feature>>} - An object each of whose properties is an array of features of a different kind.
 */
function getAllFeatures(OSM_data, bounding_box) {
	let all_features = {
		units: [],
		streets: []
	};

	for (let feature of OSM_data.features) {
		if (feature.geometry.type == "LineString" && feature.properties.highway) {
			let proposed_anchors = getUnitAnchors(feature, bounding_box),
			all_proposed_units_so_far = all_features.units;
			proposed_unit_features = generateUnitFeatures(proposed_anchors, all_proposed_units_so_far);
			all_features.units = all_features.units.concat(proposed_unit_features);
			all_features.streets.push(feature);
		}
	}

	return all_features;
}

/**
 * Given two anchors, find four nearby points on either side
 * of the street appropriate to build a unit(s) on.
 *
 * @param {Array<Array<Feature>>} unit_anchors - An array of pairs of points around which to anchor units along a street.
 * @param {Array<Feature>} proposed_unit_features - An array of features representing real estate units already proposed for construction.
 * @returns {Array<Feature>} unit_features - An array of features representing real estate units.
 */
function generateUnitFeatures(unit_anchors, proposed_unit_features) {
	let unit_features = [];
	
	for (let anchor_pair of unit_anchors) {
		for (let i of [1, -1]) {
			let anchor_a = anchor_pair[0].geometry.coordinates,
			anchor_b = anchor_pair[1].geometry.coordinates,
			street_buffer = 6 / 1000, //Distance between center of street and start of unit.
			house_depth = 18 / 1000,
			angle = turf.bearing(anchor_a, anchor_b),
			new_angle = angle <= 90 ? angle + i * 90 : angle - i * 90, //Angle of line perpendicular to the anchor segment.
			unit_feature = { 
				type: "Feature",
				geometry: {
					type: "Polygon",
					coordinates: [[]]
				}
			};
			unit_feature.geometry.coordinates[0][0] = turf.destination(anchor_a, street_buffer, new_angle).geometry.coordinates,
			unit_feature.geometry.coordinates[0][1] = turf.destination(anchor_b, street_buffer, new_angle).geometry.coordinates,
			unit_feature.geometry.coordinates[0][2] = turf.destination(anchor_b, street_buffer + house_depth, new_angle).geometry.coordinates,
			unit_feature.geometry.coordinates[0][3] = turf.destination(anchor_a, street_buffer + house_depth, new_angle).geometry.coordinates;
			unit_feature.geometry.coordinates[0][4] = turf.destination(anchor_a, street_buffer, new_angle).geometry.coordinates;

			//Exclude the unit if it overlaps with any of the other proposed units.
			var all_proposed_unit_features = unit_features.concat(proposed_unit_features); 
			if (noOverlaps(unit_feature, all_proposed_unit_features)) {
				unit_features.push(unit_feature);
			}
		}
	}

	return unit_features;
}

/**
 * Find anchors for potential units. Anchors are the pairs of start 
 * and end points along the street from which units may be constructed.
 * 
 * @param {Feature} street_feature - A GeoJSON feature object representing a street.
 * @returns {Array<Array<Feature>>} - An array of pairs of points around which to anchor units along a street.  
 */
function getUnitAnchors(street_feature, bounding_box) {
	let unit_anchors = [],
	unit_length = 14 / 1000, //Kilometers.
	unit_buffer = 3 / 1000, //Distance between units, kilometers.
	endpoint = street_feature.geometry.coordinates[street_feature.geometry.coordinates.length - 1],
	start_anchor = turf.along(street_feature, 0),
	end_anchor = turf.along(street_feature, unit_length),
	distance_along = unit_length;
	
	while (end_anchor.geometry.coordinates != endpoint) {
		//Exclude proposed anchors if they're outside of the bounding box.
		start_coord = reversedCoordinates(start_anchor.geometry.coordinates), 
		end_coord = reversedCoordinates(end_anchor.geometry.coordinates);
		if (L.latLngBounds(bounding_box).contains(start_coord) &&
			L.latLngBounds(bounding_box).contains(end_coord)) {
				unit_anchors.push([start_anchor, end_anchor]);
		}

		//Find next pair of anchors.
		start_anchor = turf.along(street_feature, distance_along + unit_buffer);
		end_anchor = turf.along(street_feature, distance_along + unit_buffer + unit_length);
		
		distance_along += unit_buffer + unit_length
	}

	return unit_anchors;
}

/**
 * Check whether a polygon overlaps with any member of an array of polygons.
 *
 * @param {Feature} polygon_feature - A geoJSON polygon feature.
 * @param {Array<Feature>} polygon_feature_array - An array of geoJSON polygon features.
 * @returns {boolean} - Whether the polygon_feature overlaps with any one in the array.
 */	
function noOverlaps(reference_polygon_feature, polygon_feature_array) {
	for (feature_array_element of polygon_feature_array) {
		let el_polygon = feature_array_element.geometry.coordinates,
		ref_polygon = reference_polygon_feature.geometry.coordinates,
		el_box = L.latLngBounds(reversedCoordinates(el_polygon)).pad(-.2),
		ref_box = L.latLngBounds(reversedCoordinates(ref_polygon)).pad(-.2),
		intersection_exists = ref_box.overlaps(el_box);

		if (intersection_exists) {
			window.poly1.push(el_box);
			window.poly2.push(ref_box);
			return false;
		}
	}
	return true;
}

/**
 * Given a geoJSON geometry object's coordinates, return the object, but with
 * all the coordinates reversed.
 * 
 * Why? L.geoJSON will auto-reverse the order of a geoJSON object's coordinates, as
 * it expects geoJSON coordinates to be lngLat. However, methods like latLngBounds.contains
 * expect standard latLng pairs and won't auto-reverse, so we have to do that
 * manually if we're preprocessing the geoJSON before passing it to L.geoJSON.
 * 
 * @param {Array<number|Array<number|Array<number>>> coordinates - GeoJSON coordinates for a point, (multi-)line, or (multi-)polygon.
 * @returns {Array<number|Array<number|Array<number>>> - Reversed geoJSON coordinates for a point, (multi-)line, or (multi-)polygon.
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
