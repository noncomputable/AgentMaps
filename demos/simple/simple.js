//Set bounds for the area on the map where the simulation will run (gotten from openstreetmap.org).
let bounding_box = [[40.6469, -73.5255], [40.6390, -73.5183]];

//Create and setup the Leaflet map object.
let map = L.map("sample_map").fitBounds(bounding_box).setZoom(16);

//Get map graphics by adding OpenStreetMap tiles to the map object.
L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
		maxZoom: 18,
	}
).addTo(map);

//Create an Agentmap.
let amap = L.A.agentmap(map);

//Generate and display streets and buildings on the map (map_data is defined in map_data.js).
amap.buildingify(bounding_box, map_data);

//Start some number of agents off sick, and make a custom seqUnitAgentMaker to make agents the perimeter streets.
//Generate 50 agents according to the rules of seqUnitAgentMaker, displaying them as red, .5 meter radius circles.
amap.agentify(1, amap.seqUnitAgentMaker);

//Do the following on each tick of the simulation.
amap.update_func = function() {
	if (amap.state.ticks === 0) {
		amap.agents.eachLayer(function(agent) {
			//Get a new unit and its ID randomly.
			let new_unit = amap.units.getLayers()[Math.floor(amap.units.count()*Math.random())],
			new_unit_id = amap.units.getLayerId(new_unit);

			//Schedule the agent to move to the center of the new unit.
			agent.setTravelToPlace(new_unit.getBounds().getCenter(), {"unit": new_unit_id}, 2, true);

			//Have the agent start its trip.
			agent.startTrip();
		});
	let a = amap.agents.getLayers()[0];
	a.travel_state.path.forEach(p => L.circleMarker(p, {"radius": .5, "color": "blue"}).addTo(map));
	let path = [];
	for (let point of a.travel_state.path) {
	if (!path.some(el => el.lat === point.lat && el.lng === point.lng)) {
	path.push(point);
	a.travel_state.path = path;
}
}
	}
};
