//Set bounds for the area on the map where the simulation will run.
let bounding_box = [[40.6469, -73.5255], [40.6390, -73.5183]];

//Create and setup the Leaflet map.
let map = L.map("sample_map").fitBounds(bounding_box).setZoom(16);

//Add visuals to the map by adding OpenStreetMap (open source GIS data project) tiles and displaying them.
L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
		maxZoom: 18,
	}
).addTo(map);

//Create an Agentmap.
let amap = L.A.agentmap(map);

//Generate and display streets and buildings on the map.
amap.buildingify(bounding_box, sample_data);

//Generate 100 agents according to the rules of seqUnitAgentMaker, displaying them as red, .5 meter radius circles.
amap.agentify(100, amap.seqUnitAgentMaker, {radius: .5, color: "red", fillColor: "red"});

//Do the following on each new tick.
amap.update_func = function() {
	//Perform the following actions for each agent every 20 ticks.
	if (amap.state.tick % 20 === 0) {
		amap.agents.eachLayer(function(agent) {
			//Get a random unit and its ID.
			let new_unit = amap.units.getLayers()[Math.floor(amap.units.count()*Math.random())],
			new_unit_id = amap.units.getLayerId(new_unit);

			//Schedule the agent move to the spot on the street across of the unit's door.
			agent.setTravelNearUnit(new_unit_id);

			//Then, schedule the agent move to the center of the unit.
			agent.setTravelToPlace({"unit": new_unit_id}, new_unit.getBounds().getCenter());

			//Have the agent start its trip.
			agent.startTrip();
		});
	}
};

//Run the Agentmap simulation.
amap.run();
