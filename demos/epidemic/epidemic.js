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

//Do the following on each tick of the simulation.
amap.update_func = function() {
	let ticks_display = document.getElementById("tick_value");
	ticks_display.textContent = amap.state.ticks;
}

let zoned_units = getZonedUnits();

//Find and store the units on the perimeter of the lower part of the neighborhood,
//and along the streets in the upper part of the neighborhood.
function getZonedUnits() {
	let perimeter_streets = ["Judith Drive", "Jason Drive"],
	upper_streets = ["Ira Road", "Timothy Road", "Susan Road", "Lydia Court", "Ardis Place", "Ricky Street"],
	perimeter_units = [],
	upper_units = [];

	amap.units.eachLayer(function(unit) {
		let street_id = unit.street_id,
		street = amap.streets.getLayer(street_id),
		street_name = street.feature.properties.name;

		if (perimeter_streets.includes(street_name)) {
			perimeter_units.push(unit._leaflet_id);
		}

		
		if (upper_streets.includes(street_name)) {
			upper_units.push(unit._leaflet_id);
		}

		//For each unit, track which agents are in it for easy searching.
		unit.resident_ids = [];
	});

	perimeter_units = pick_random_n(perimeter_units, 25);
	upper_units = pick_random_n(upper_units, 25);

	let zoned_units = {
		commercial: upper_units,
		residential: perimeter_units
	};

	return zoned_units;
}

//Return a GeoJSON feature representing an agent.
function epidemicAgentMaker(i) {
	let random_residential_index = Math.floor(Math.random() * zoned_units.residential.length),
	random_residential_unit_id = zoned_units.residential[random_residential_index],
	random_residential_unit = amap.units.getLayer(random_residential_unit_id),
	center_coords = L.A.pointToCoordinateArray(random_residential_unit.getCenter());
	
	let feature = { 
		"type": "Feature",
		"properties": {
			"place": {
				"unit": random_residential_unit_id
			},
			"layer_options": {
				"color": "blue",
				"radius": .5
			},
			"prev_unit_id": random_residential_unit_id,
			"infected": false,
			"recovery_tick": 0,
			"commuting_to": null
		},
		"geometry": {
			"type": "Point",
			"coordinates": center_coords
		},
	};

	return feature;
}

//Generate 50 agents according to the rules of epidemicAgentMaker, displaying them as blue, .5 meter radius circles.
amap.agentify(50, epidemicAgentMaker);

//Keep a count of how many infected agents there are.
amap.infected_count = 0;

//Infect a certain percent of the population, randomly.
function infect(percent) {
	let number_of_infectees = Math.ceil(amap.agents.count() * percent),
	infectees = pick_random_n(amap.agents.getLayers(), number_of_infectees);
	infectees.forEach(infectee => infectAgent(infectee));
}

infect(.1);

amap.agents.eachLayer(function(agent) {
	//Do the following on each tick of the simulation, for each agent.
	agent.update_func = function() {
		//Only do this if it's the start of the simulation.
		if (amap.state.ticks === 0) {
			onStart(agent);
		}
		//Do this every every go_work_time ticks, starting from the start of the simulation, unless the agent is either
		//already at work or commuting home.
		else if (amap.state.ticks % agent.go_work_time === 0 && agent.commuting_to !== "home" && agent.place.unit !== agent.workplace) {
			commuteToWork(agent);
		}
		//Do this every other go_home_time ticks, unless the agent is either already at home or commuting to work.
		else if (amap.state.ticks % agent.go_home_time === 0 && agent.commuting_to !== "work" && agent.place.unit !== agent.home) {
			commuteToHome(agent);
		}
		
		checkCommute(agent);
		updateResidency(agent);
		checkInfection(agent);
	};
});

function updateResidency(agent) {
	if ((typeof agent.place.unit !== "undefined" && agent.prev_unit_id !== agent.place.unit) || 
		(typeof agent.place.street !== "undefined" && agent.prev_unit_id !== -1)) {
		if (agent.prev_unit_id !== -1) {
			let prev_unit = amap.units.getLayer(agent.prev_unit_id),
			prev_unit_resident_index = prev_unit.resident_ids.indexOf(agent._leaflet_id);
			prev_unit.resident_ids.splice(prev_unit_resident_index, 1);
		}

		if (typeof agent.place.unit !== "undefined") {
			let unit = amap.units.getLayer(agent.place.unit);
			unit.resident_ids.push(agent._leaflet_id);
			agent.prev_unit_id = agent.place.unit;
		}
		else if (typeof agent.place.street !== "undefined") {
			agent.prev_unit_id = -1;
		}
	}
}

function checkInfection(agent) {
	if (agent.place.unit >= 0) {
		console.log("here");
		let resident_ids = amap.units.getLayer(agent.place.unit).resident_ids;

		for (let i = 0; i < resident_ids.length; i++) {
			let resident = amap.agents.getLayer(resident_ids[i]);
			if (resident.infected === true) {
		console.log("jhere");
				if (Math.random() < .9) {
		console.log("khere");
					infectAgent(agent);
				}
			}
		}
	}

	if (agent.infected && amap.state.ticks === agent.recovery_tick) {
		uninfectAgent(agent);
	}
}

function infectAgent(agent) {
	agent.infected = true,
	agent.recovery_tick = amap.state.ticks + Math.floor(Math.random() * 2000);
	agent.setStyle({color: "red"});

	amap.infected_count++;
	updateEpidemicStats();
}

function uninfectAgent(agent) {
	agent.infected = false,
	agent.recovery_tick = 0,
	agent.setStyle({color: "blue"});
	
	amap.infected_count--;
	updateEpidemicStats();
}

function updateEpidemicStats() {
	let infected_display = document.getElementById("infected_value");
	infected_display.textContent = amap.infected_count;

	let healthy_display = document.getElementById("healthy_value");
	healthy_display.textContent = amap.agents.count() - amap.infected_count;
}

function commuteToWork(agent) {
	agent.commuting_to = "work";
	
	//Schedule the agent to move to the center of its workplace.
	let workplace_unit = amap.units.getLayer(agent.workplace.unit);
	agent.setTravelToPlace(workplace_unit.getCenter(), agent.workplace, 3, true);

	//Have the agent start its trip.
	agent.startTrip();
}

function commuteToHome(agent) {
	agent.commuting_to = "home";

	//Schedule the agent to move to the center of its home unit and replace the currently schedule trip.
	agent.setTravelToPlace(agent.home.lat_lng, agent.home, 3, true);

	//Have the agent start its trip.
	agent.startTrip();
}

function checkCommute(agent) {
	if ((agent.place.unit === agent.home.unit && agent.commuting_to === "home") ||
		(agent.place.unit === agent.workplace.unit && agent.commuting_to === "work")) {
		agent.commuting_to = null;
	}
}

function onStart(agent) {
	//Store the agent's starting coordinates and unit ID as its "home".
	agent.home = { 
		lat_lng: agent.getLatLng(),
		unit: agent.place.unit
	};

	//Get a new unit from the upper neighborhood and its ID randomly.
	let random_workplace_index = Math.floor(zoned_units.commercial.length * Math.random()),
	random_workplace_id = zoned_units.commercial[random_workplace_index];

	//Store a random unit in the upper neighborhood as the agent's "workplace".
	agent.workplace = {
		unit: random_workplace_id
	};
	
	//Approximately many ticks until any agent goes to work or back home will be based on these numbers.
	let go_work_base_time = 3000,
	go_home_base_time = 6000;
	
	//Randomize how early or late agents make their commute.
	let sign = Math.random() < .5 ? 1 : -1,
	travel_randomizer = sign * Math.floor(Math.random() * 250);

	agent.go_work_time = go_work_base_time + travel_randomizer,
	agent.go_home_time = go_home_base_time + travel_randomizer;
};

function pick_random_n(array, n) {
	let random_indices = [];

	for (let i = 0; i < n; i++) {
		let random_index = Math.floor(Math.random() * array.length);
		if (!random_indices.includes(random_index)) {
			random_indices.push(random_index);
		}
		else {
			i--;
		}
	}
	
	let random_n = random_indices.map(index => array[index]);

	return random_n;
}
