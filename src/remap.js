function mapify (map, OSM_data, OSM_data_URI) {
	//if (!GeoJSON_data && GeoJSON_data_URI) {}
	
	var OSM_options = {
		onEachFeature: generateUnits,
		style:	{
			"color": "black",
			"weight": 1,
			"opacity": .65
		}
	};
				
	/*agentmap.layers.OSM_features = L.geoJSON(
		OSM_data,
		OSM_options
	).addTo(agentmap.map);*/


	var agent_units_options = {
		style: {
			"color": "green",
			"weight": 1,
			"opacity": .87
		}
	};

	for (var feature of OSM_data.features) {
		generateUnits(feature);
	}
	
	agentmap.layers.agent_units = L.geoJSON(
		agentmap.layers.agent_units,
		agent_units_options
	).addTo(agentmap.map);
}

function generateUnits(street_feature, street_layer) {
	if (street_feature.geometry.type == "LineString" && street_feature.properties.highway) {
		var unit_anchors = getUnitAnchors(street_feature),
		unit_specs = getUnitSpecs(unit_anchors),
		new_units = unit_specs;
		agentmap.layers.agent_units.features = agentmap.layers.agent_units.features.concat(new_units);
	}
}

//Find anchors for potential units. Anchors are the pairs of start 
//and end points along the street from which units may be constructed.
function getUnitAnchors(street) {
	var unit_anchors = [],
	unit_length = 14 / 1000, //kilometers
	unit_buffer = 3 / 1000, //distance between units, kilometers
	endpoint = street.geometry.coordinates[street.geometry.coordinates.length - 1],
	start_anchor = turf.along(street, 0),
	end_anchor = turf.along(street, unit_length),
	distance_along = unit_length;
	
	while (end_anchor.geometry.coordinates != endpoint) {
		unit_anchors.push([start_anchor, end_anchor]);
		
		//Find next pair of anchors
		start_anchor = turf.along(street, distance_along + unit_buffer);
		end_anchor = turf.along(street, distance_along + unit_buffer + unit_length);
		
		distance_along += unit_buffer + unit_length
	}

	return unit_anchors;
}

//Given two anchors, find four nearby points on either side
//of the street appropriate to form a unit.
function getUnitSpecs(unit_anchors) {
	var unit_specs = [];
	for (var anchor_pair of unit_anchors) {
		var anchor_a = anchor_pair[0].geometry.coordinates,
		anchor_b = anchor_pair[1].geometry.coordinates,
		street_buffer = 6 / 1000, //distance between center of street and start of unit
		house_depth = 10 / 1000,
		angle = turf.bearing(anchor_a, anchor_b),
		new_angle = angle <= 90 ? angle + 90 : angle - 90, //angle of line perpendicular to the anchor segment
		unit_spec = { 
			type: "Feature",
			geometry: {
				type: "Polygon",
				coordinates: [[]]
			}
		};
		unit_spec.geometry.coordinates[0][0] = turf.destination(anchor_a, street_buffer, new_angle).geometry.coordinates,
		unit_spec.geometry.coordinates[0][1] = turf.destination(anchor_b, street_buffer, new_angle).geometry.coordinates,
		unit_spec.geometry.coordinates[0][2] = turf.destination(anchor_b, street_buffer + house_depth, new_angle).geometry.coordinates,
		unit_spec.geometry.coordinates[0][3] = turf.destination(anchor_a, street_buffer + house_depth, new_angle).geometry.coordinates;
		unit_specs.push(unit_spec);
	}

	return unit_specs;
}
