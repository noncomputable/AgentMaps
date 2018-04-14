/**
 * @typedef {object} Feature
 * @property {string} type - Should be Feature.
 * @property {object} properties - Non-geometric properties describing the map feature.
 * @property {object} geometry - Specification of the feature's geometry.
 * @property {string} geometry.type - The feature's GeoJSON geometry type
 * @property {Array<>} geometry.coordinates - The coordinates specifying the feature's geometry.
 * @see {@link http://geojson.org/}
 */

/**
 * Generate and setup the desired map features (e.g. streets, houses).
 *
 * @param {Object} map - A Leaflet Map object.
 * @param {Array.<Array.<number>>} bounding_box - The map's top-left and bottom-right coordinates.
 * @param {Object} OSM_data - A GeoJSON Feature Collection object containing the OSM features inside the bounding box.
 * @param {string} OSM_data_URL - URL from which to download equivalent OSM_data.
 */
function mapify (map, bounding_box, OSM_data, OSM_data_URL) {
	//if (!GeoJSON_data && GeoJSON_data_URL) {}
	
	var all_features = getAllFeatures(OSM_data);
	
	var unit_options = {
		style: {
			"color": "green",
			"weight": 1,
			"opacity": .87
		}
	};

	var unit_feature_collection = { 
		type: "FeatureCollection", 
		features: all_features.units
	};

	agentmap.layers.units = L.geoJSON(
		unit_feature_collection,
		unit_options
	).addTo(agentmap.map);

	var street_options = {
		style: {
			"color": "yellow",
			"weight": 4,
			"opacity": .5
		}
	};

	var street_feature_collection = {
		type: "FeatureCollection",
		features: all_features.streets
	};
	
	agentmap.layers.streets = L.geoJSON(
		street_feature_collection,
		street_options
	).addTo(agentmap.map);
}

/**
 * @param {Object} OSM_data - A GeoJSON Feature Collection object containing the OSM features of the bounding box.
 * @returns {Object<string, Array<Feature>>} - An object whose properties are arrays of features of different kinds.
 */
function getAllFeatures(OSM_data) {
	var all_features = {
		units: [],
		streets: []
	};

	for (var feature of OSM_data.features) {
		if (feature.geometry.type == "LineString" && feature.properties.highway) {
			var proposed_anchors = getUnitAnchors(feature),
			proposed_unit_features = generateUnitFeatures(proposed_anchors);
			//unit_features = withoutOverlappedUnits(proposed_unit_specs)
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
 * @returns {Array<Feature>} unit_features - An array of features representing real estate units.
 */
function generateUnitFeatures(unit_anchors) {
	var unit_features = [];
	
	for (var anchor_pair of unit_anchors) {
		for (var i of [1, -1]) {
			var anchor_a = anchor_pair[0].geometry.coordinates,
			anchor_b = anchor_pair[1].geometry.coordinates,
			street_buffer = 6 / 1000, //distance between center of street and start of unit
			house_depth = 18 / 1000,
			angle = turf.bearing(anchor_a, anchor_b),
			new_angle = angle <= 90 ? angle + i * 90 : angle - i * 90, //angle of line perpendicular to the anchor segment
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
			unit_feature.geometry.coordinates[0][4] = turf.destination(anchor_a, street_buffer, new_angle).geometry.coordinates,
			unit_features.push(unit_feature);
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
function getUnitAnchors(street_feature) {
	var unit_anchors = [],
	unit_length = 14 / 1000, //kilometers
	unit_buffer = 3 / 1000, //distance between units, kilometers
	endpoint = street_feature.geometry.coordinates[street_feature.geometry.coordinates.length - 1],
	start_anchor = turf.along(street_feature, 0),
	end_anchor = turf.along(street_feature, unit_length),
	distance_along = unit_length;
	
	while (end_anchor.geometry.coordinates != endpoint) {
		unit_anchors.push([start_anchor, end_anchor]);
		
		//Find next pair of anchors
		start_anchor = turf.along(street_feature, distance_along + unit_buffer);
		end_anchor = turf.along(street_feature, distance_along + unit_buffer + unit_length);
		
		distance_along += unit_buffer + unit_length
	}

	return unit_anchors;
}

function withoutOverlappedUnits(proposed_units_specs) {
	var units_specs = units.slice();
	for (var unit of units.slice(0,500)) {
		var index = units.indexOf(feature);
		var bounds = L.latLngBounds([unit.geometry.coordinates[0], unit.geometry.coordinates[3]]);
		for (var alt_unit of units.slice(0,500)) {
			var alt_bounds = L.latLngBounds([alt_unit.geometry.coordinates[0], alt_unit.geometry.coordinates[3]]);
			if (bounds.intersects(alt_bounds) && bounds != alt_bounds) {
				units.splice(index, 1);
			}
		}
	}

	return units_specs;
}
