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
amap.agentify(50, amap.seqUnitAgentMaker, {radius: .5, color: "red", fillColor: "red"});

//Do the following on each tick of the simulation.
amap.update_func = function() {
	//Have the agent leave and come home from work some random moment within one minute of 6000 ticks. Give them a workplace in an interior street.
	//Do this at the start of the simulation and then every 600 ticks.
	if (amap.state.ticks % 6000 === 0) {
		amap.agents.eachLayer(function(agent) {
			//Only do this if it's the start of the simulation.
			if (amap.state.ticks === 0) {
				//Store the agent's starting coordinates and unit ID as its "home".
				agent.home = { 
					lat_lng: agent.getLatLng(),
					unit: agent.place.unit
				};
			}

			//Get a new unit and its ID randomly.
			let new_unit = amap.units.getLayers()[Math.floor(amap.units.count()*Math.random())],
			new_unit_id = amap.units.getLayerId(new_unit);

			//Schedule the agent to move to the center of the new unit.
			agent.setTravelToPlace(new_unit.getBounds().getCenter(), {"unit": new_unit_id}, true);

			//Have the agent start its trip.
			agent.startTrip();
		});
	}

	//Do this every other 300 ticks.
	if (amap.state.ticks % 3000 === 0 && amap.state.ticks % 6000 !== 0) {
		amap.agents.eachLayer(function(agent) {
			//Schedule the agent to move to the center of its home unit and replace the currently schedule trip.
			agent.setTravelToPlace(agent.home.lat_lng, {"unit": agent.home.unit}, true);

			//Have the agent start its trip.
			agent.startTrip();
		});
	}

	//Do this every tick.
	//Check if each other agent is in the same unit as the agent, and then with some probability set its property to sick and change its color if
	//a sick agent is there. Also occassionally visit a neighbors house.
};
