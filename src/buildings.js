(function(A) {
	if (typeof(A) === "undefined") {
		throw new Error("L.A is undefined! Make sure Agentmaps was setup properly in first function of AgentMaps.js (agentmap.js in /src).");
	}

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
	function buildingify(bounding_box, OSM_data, OSM_data_URL) {
		//if (!GeoJSON_data && GeoJSON_data_URL) {}
		
		let street_features = getStreetFeatures(OSM_data);
		
		let street_options = {
			style: {
				"color": "yellow",
				"weight": 4,
				"opacity": .5
			},
		};

		let street_feature_collection = {
			type: "FeatureCollection",
			features: street_features
		};
		
		this.streets = L.geoJSON(
			street_feature_collection,
			street_options
		).addTo(this.map);

		let unit_features = getUnitFeatures.bind(this)(OSM_data, bounding_box);
	
		let unit_options = {
			style: {
				"color": "green",
				"weight": 1,
				"opacity": .87
			},
		};

		let unit_feature_collection = { 
			type: "FeatureCollection", 
			features: unit_features
		};
		
		this.units = L.geoJSON(
			unit_feature_collection,
			unit_options
		).addTo(this.map);

		this.units.eachLayer(function(layer) {
			layer.street_id = layer.feature.properties.street_id,
			layer.street_anchors = layer.feature.properties.street_anchors
		});
	}

	/**
	 * Get all appropriate units within the desired bounding box.
	 *
	 * @param {Object} OSM_data - A GeoJSON Feature Collection object containing the OSM features inside the bounding box.
	 * @returns {Array<Feature>} - An array of features representing real estate units.
	 */
	function getUnitFeatures(OSM_data, bounding_box) {
		let proposed_unit_features = [];
		
		this.streets.eachLayer(function(layer) {
			let street_feature = layer.feature,
			street_id = layer._leaflet_id,
			proposed_anchors = getUnitAnchors(street_feature, bounding_box);

			new_proposed_unit_features = generateUnitFeatures(proposed_anchors, proposed_unit_features, street_id),
			proposed_unit_features = proposed_unit_features.concat(new_proposed_unit_features);
		});

		unit_features = unitsOutOfStreets(proposed_unit_features, this.streets);

		return unit_features;
	}

	/**
	 * Get all streets from the GeoJSON data.
	 *
	 * @param {Object} OSM_data - A GeoJSON Feature Collection object containing the OSM streets inside the bounding box.
	 * @returns {Array<Feature>} - An array of street features.
	*/
	function getStreetFeatures(OSM_data) {
		let street_features = [];

		for (let i =  0; i < OSM_data.features.length; ++i) {
			let feature = OSM_data.features[i];
			
			if (feature.geometry.type === "LineString" && feature.properties.highway) {
				let street_feature = feature;
				street_features.push(street_feature);
			}
		}

		return street_features;
	}

	/**
	 * Given two anchors, find four nearby points on either side
	 * of the street appropriate to build a unit(s) on.
	 *
	 * @param {Array<Array<Feature>>} unit_anchors - An array of pairs of points around which to anchor units along a street.
	 * @param {Array<Feature>} proposed_unit_features - An array of features representing real estate units already proposed for construction.
	 * @param {string} street_feature_id - The Leaflet layer ID of the street feature along which the unit is being constructed..
	 * @returns {Array<Feature>} unit_features - An array of features representing real estate units.
	 */
	function generateUnitFeatures(unit_anchors, proposed_unit_features, street_feature_id) {
		let unit_features = [];
		
		for (let anchor_pair of unit_anchors) {
			for (let i of [1, -1]) {
				let anchor_a = anchor_pair[0].geometry.coordinates,
				anchor_b = anchor_pair[1].geometry.coordinates,
				anchor_latLng_pair = [anchor_a, anchor_b],
				street_buffer = 6 / 1000, //Distance between center of street and start of unit.
				house_depth = 18 / 1000,
				angle = turf.bearing(anchor_a, anchor_b),
				new_angle = angle <= 90 ? angle + i * 90 : angle - i * 90, //Angle of line perpendicular to the anchor segment.
				unit_feature = { 
					type: "Feature",
					properties: {
						street: "none"
					},
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
					unit_feature.properties.street_id = street_feature_id,
					unit_feature.properties.street_anchors = anchor_latLng_pair;

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
	 * Get an array of units excluding units that overlap with streets.
	 *
	 * @param {Array<Feature>} unit_features - Array of features representing units.
	 * @param {Array<Layer>} street_layers - Array of Leaflet layers representing streets.
	 * @returns {Array<Feature>} - unit_features, but with all units that intersect any streets removed.
	 */
	function unitsOutOfStreets(unit_features, street_layers) {
		let processed_unit_features = unit_features.slice();
		
		street_layers.eachLayer(function(street_layer) {
			let street_feature = street_layer.feature;
			for (let unit_feature of processed_unit_features) {
				let intersection_exists = turf.lineIntersect(street_feature, unit_feature).features.length > 0;
				if (intersection_exists) {
					processed_unit_features.splice(processed_unit_features.indexOf(unit_feature), 1, null);
				}
			}	
		
			processed_unit_features = processed_unit_features.filter(feature => feature === null ? false : true);
		});
		

		return processed_unit_features;
	}

	/**
	 * Check whether a polygon overlaps with any member of an array of polygons.
	 *
	 * @param {Feature} polygon_feature - A geoJSON polygon feature.
	 * @param {Array<Feature>} polygon_feature_array - An array of geoJSON polygon features.
	 * @returns {boolean} - Whether the polygon_feature overlaps with any one in the array.
	 */	
	function noOverlaps(reference_polygon_feature, polygon_feature_array) {
		return true;
		for (feature_array_element of polygon_feature_array) {
			let overlap_exists = turf.intersect(reference_polygon_feature, feature_array_element);
			if (overlap_exists) {
				return false;
			}
		}
		return true;
	}

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
	 * Given an array, check whether it can be the coordinates of a point.
	 *
	 * @param {Array} array - An array to check.
	 * @returns {boolean} - Whether the array can be the coordinates of a point.
	 */
	function isPointCoordinates(array) {
		if (array.length !== 2 || 
			typeof(array[0]) !== "number" ||
			typeof(array[1]) !== "number") {
			return false;
		}

		return true;
	}

	/**
	 * Given either a GeoJSON feature, L.latLng, or coordinate array containing the coordinates of a point,
	 * return an array of the coordinates.
	 *
	 * @params {Point|Array<number>|LatLng} point - The data containing the point's coordinates (latitude & longitude).
	 * @returns {Array<number>} - An array of the point's coordinates. I.e.: [lng, lat].
	 */
	function pointToCoordinateArray(point) {
		if (typeof(point.lat) === "number" && typeof(point.lng) === "number") {
			coordinate_array = [point.lng, point.lat];
		}
		else if (point.geometry && point.geometry.coordinates && A.isPointCoordinates(point.geometry.coordinates)) {
			coordinate_array = point.geometry.coordinates;
		}
		else if (!isPointCoordinates(point)) {
			throw new Error("Invalid point: point must either be array of 2 coordinates, or an L.latLng.");
		}

		return coordinate_array;
	}

	//TODO: SAVE NEIGHBORS OF BUILDINGS AS WELL AS BUILDING ACROSS THE STREET, FROM THAT IMPLEMENTING ALL OTHER SORTS OF NEIGHBOR RELATION ALGORITHMS
	//WILL BE EASY
	
	A.reversedCoordinates = reversedCoordinates;
	A.isPointCoordinates = isPointCoordinates;
	A.pointToCoordinateArray = pointToCoordinateArray;
	A.Agentmap.prototype.buildingify = buildingify;
}(L.A));
