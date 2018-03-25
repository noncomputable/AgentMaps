function generateUnits(feature, layer) {
	if (feature.geometry.type == "LineString") {
		var nodes = feature.geometry.coordinates;

		//Skip last node of street
		for (var i = 0; i < nodes.length - 1; i++) {
			var prev_node = nodes[i];
			var next_node = nodes[i + 1];
			var unit_anchors = getUnitAnchors(prev_node, next_node);
//			var unit_specs = getUnitSpecs(unit_anchors);
			agentmaps.features.units = agentmaps.features.units.concat(unit_specs)
		}
	}
}

//Find anchors for potential units. Anchors are the start and
//end points along the street off of which units are specified.
function getUnitAnchors(prev_node, next_node, start_proposal = prev_node) {
	var dist_to_next_node = start_proposal.distanceTo(next_node);
	if (dist_to_next_node >= 7) {
		end_proposal = getLinePosAhead(start_proposal, next_node, 7);
	}
	else {
		var left_over_dist = 7 - dist_to_next_node;
		//somehow search through the remaining segments of the street until finding one with dist_to_next_node >= left_over_dist and
		//add set the end_proposal to the appropriate point
	}
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
