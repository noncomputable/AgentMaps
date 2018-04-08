function mapify (map, geoJSON_data, geoJSON_data_URI) {
	//if (!GeoJSON_data && GeoJSON_data_URI) {}
	
	var geoJSON_options = {
		onEachFeature: generateUnits,
		style:	{
			"color": "black",
			"weight": 1,
			"opacity": .65
		}
	};
				
	agentmap.layers.OSM_features = L.geoJSON(
		geoJSON_data,
		geoJSON_options
	).addTo(agentmap.map);

	agentmap.layers.agent_units = L.geoJSON(
		agentmap.layers.agent_units
	).addTo(agentmap.map);
}

function generateUnits(street_feature, street_layer) {
	if (street_feature.geometry.type == "LineString" && street_feature.properties.highway) {
		var unit_anchors = getUnitAnchors(street_feature);
		//var unit_specs = getUnitSpecs(unit_anchors);
		//var new_units_layer = L.geoJSON(unit_specs);
		var new_units_layer = unit_anchors;
		agentmap.layers.agent_units.features = agentmap.layers.agent_units.features.concat(new_units_layer);
	}
}

//Find anchors for potential units. Anchors are the pairs of start 
//and end points along the street from which units may be constructed.
function getUnitAnchors(street) {
	var unit_anchors = [],
	unit_length = 14 / 1000, //kilometers
	unit_buffer = 3 / 1000, //distance between units, kilometers
	endpoint = street.geometry.coordinates[street.geometry.coordinates.length - 1],
	start_anchor = street.geometry.coordinates[0],
	end_anchor = turf.along(street, unit_length),
	distance_along = unit_length;
	console.log("one", endpoint);
	
	while (end_anchor.geometry.coordinates != endpoint) {
		console.log(end_anchor);
		unit_anchors = unit_anchors.concat([start_anchor, end_anchor]);
		
		//Find next pair of anchors
		start_anchor = turf.along(street, distance_along + unit_buffer);
		end_anchor = turf.along(street, distance_along + unit_buffer + unit_length);
		
		distance_along += unit_buffer + unit_length
	}

	return unit_anchors;
}

//Given two anchors, find four nearby points on either side
//of the street appropriate to form a unit.
function getUnitSpecs() {
}

//Given two points, find the point at a certain distance along
//the line segment between the two points.
function getLinePosAhead(first_point, second_point, distance) {
	
}

//Create polygons on the map for each unit.
function draw_units() {
}
