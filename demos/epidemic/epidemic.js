/*						     */
/* Setup the AgentMaps simulation and its interface. */
/*						     */ 

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

//Setup the epidemic simulation.
function setupEpidemic(agentmap) {
	//Do the following on each tick of the simulation.
	agentmap.update_func = function() {
		let ticks_display = document.getElementById("tick_value");
		ticks_display.textContent = agentmap.state.ticks;
	}

	//Generate and display streets and buildings on the map (map_data is defined in map_data.js).
	agentmap.buildingify(bounding_box, map_data, undefined, {"color": "black", "weight": 1.5, "opacity": .6});

	//Split the map's units into residential and commercial zones.
	let perimeter_streets = ["Judith Drive", "Jason Drive"],
	upper_streets = ["Ira Road", "Timothy Road", "Susan Road", "Lydia Court", "Ardis Place", "Ricky Street"];
	agentmap.zoned_units = getZonedUnits(agentmap, perimeter_streets, upper_streets);

	//Use only a subset of the zoned units.
	agentmap.zoned_units.residential = pick_random_n(agentmap.zoned_units.residential, 25),
	agentmap.zoned_units.commercial = pick_random_n(agentmap.zoned_units.commercial, 25);

	//Generate 50 agents according to the rules of epidemicAgentMaker, displaying them as blue, .5 meter radius circles.
	agentmap.agentify(50, epidemicAgentMaker);

	//Keep a count of how many infected agents there are.
	agentmap.infected_count = 0;

	//Set how infectious the disease is (the probability that someone nearby will get infected)
	agentmap.infection_probability = .00001;

	//Set each Agent up.
	agentmap.agents.eachLayer(function(agent) {
		//Add the agent's ID to its home unit's resident_ids array to help keep track of which agents are in the same unit.
		let home_unit = agentmap.units.getLayer(agent.home_id);
		home_unit.resident_ids.push(agent._leaflet_id);

		//Set the update_func for each agent.
		//Do the following on each tick of the simulation, for each agent.
		agent.update_func = function() {
			//Do this every every go_work_time ticks, starting from the start of the simulation, unless the agent is either
			//already at work or commuting home.
			if (agentmap.state.ticks % agent.go_work_time === 0 && agent.commuting_to !== "home" && agent.place.unit !== agent.workplace) {
				commuteToWork(agent);
			}
			//Do this every other go_home_time ticks, unless the agent is either already at home or commuting to work.
			else if (agentmap.state.ticks % agent.go_home_time === 0 && agent.commuting_to !== "work" && agent.place.unit !== agent.home) {
				commuteToHome(agent);
			}
			
			checkCommute(agent);
			updateResidency(agent);
			checkInfection(agent);
		};
	});

	//Infect a random 10% of the population on the amap.
	infect(agentmap, .1);
}


/*                                                 */
/* Function definitions for everything done above. */
/*                                                 */

//Given two arrays of streets and their agentmap, split their units into residential and commercial zones,
//and return their division.
function getZonedUnits(agentmap, residential_streets, commercial_streets) {
	let zoned_units = {
		residential: [],
		commercial: []
	};

	//Find and store the units on the perimeter of the lower part of the neighborhood,
	//and along the streets in the upper part of the neighborhood.
	amap.units.eachLayer(function(unit) {
		let street_id = unit.street_id,
		street = amap.streets.getLayer(street_id),
		street_name = street.feature.properties.name;

		if (residential_streets.includes(street_name)) {
			zoned_units.residential.push(unit._leaflet_id);
		}

		
		if (commercial_streets.includes(street_name)) {
			zoned_units.commercial.push(unit._leaflet_id);
		}

		//For each unit, add an array to store which agents are in it for easy searching.
		unit.resident_ids = [];
	});

	return zoned_units;
}

//Return a GeoJSON feature representing an agent.
function epidemicAgentMaker(i) {
	//Get a random residential unit and its center.
	let random_residential_index = Math.floor(Math.random() * this.zoned_units.residential.length),
	random_residential_unit_id = this.zoned_units.residential[random_residential_index];
	
	//Store the residential unit's ID as the agent's home ID.
	let home_id = random_residential_unit_id;

	//Get a random commercial unit and its ID.
	let random_workplace_index = Math.floor(this.zoned_units.commercial.length * Math.random()),
	random_workplace_id = this.zoned_units.commercial[random_workplace_index];

	//Store the commercial unit's ID as the agent's workplace ID.
	let workplace_id = random_workplace_id;
	
	//Approximately many ticks until any agent goes to work or back home will be based on these numbers.
	let go_work_base_time = 3000,
	go_home_base_time = 6000;
	
	//Randomize how early or late agents make their commute.
	let sign = Math.random() < .5 ? 1 : -1,
	travel_randomizer = sign * Math.floor(Math.random() * 250);

	let go_work_time = go_work_base_time + travel_randomizer,
	go_home_time = go_home_base_time + travel_randomizer;

	//Get the agent's starting position.
	let home_unit = this.units.getLayer(home_id),
	home_center_coords = L.A.pointToCoordinateArray(home_unit.getCenter());
	
	let feature = { 
		"type": "Feature",
		"properties": {
			"place": {
				"unit": home_id
			},
			"layer_options": {
				"color": "blue",
				"radius": .5
			},
			"recent_unit_id": home_id,
			"commuting_to": null,
			"home_id": home_id,
			"workplace_id": workplace_id,
			"go_work_time": go_work_time,
			"go_home_time": go_home_time,
			"infected": false,
			"recovery_tick": 0,
		},
		"geometry": {
			"type": "Point",
			"coordinates": home_center_coords
		},
	};

	return feature;
}

//Track an agent's transitions between units and update the units' residence_id's accordingly.
function updateResidency(agent) {
	//Check if the agent has just moved to either a new unit or from a unit to a street.
	if ((typeof agent.place.unit !== "undefined" && agent.recent_unit_id !== agent.place.unit) || 
		(typeof agent.place.street !== "undefined" && agent.recent_unit_id !== "street")) {
		//If the agent has just moved from a unit (not from a street), remove it from the units resident_ids.
		if (agent.recent_unit_id !== "street") {
			let recent_unit = amap.units.getLayer(agent.recent_unit_id),
			recent_unit_resident_index = recent_unit.resident_ids.indexOf(agent._leaflet_id);
			recent_unit.resident_ids.splice(recent_unit_resident_index, 1);
		}

		//If the agent has just moved to a unit, add it to the unit's resident_ids.
		if (typeof agent.place.unit !== "undefined") {
			let unit = agent.agentmap.units.getLayer(agent.place.unit);
			unit.resident_ids.push(agent._leaflet_id);
			agent.prev_unit_id = agent.place.unit;
		}
		//Otherwise, if the agent has just moved to a street, just set its previous unit ID to "street".
		else if (typeof agent.place.street !== "undefined") {
			agent.recent_unit_id = "street";
		}
	}
}

//Check whether the agent should recover or become infected.
function checkInfection(agent) {
	//Check whether the agent is in a unit. If so, if any other agents in the unit are infected,
	//infect it with a certain probability.
	if (agent.place.unit >= 0 && agent.infected === false) {
		let resident_ids = agent.agentmap.units.getLayer(agent.place.unit).resident_ids;

		for (let i = 0; i < resident_ids.length; i++) {
			let resident = agent.agentmap.agents.getLayer(resident_ids[i]);
			if (resident.infected) {
				if (Math.random() < agent.agentmap.infection_probability) {
					infectAgent(agent);
					break;
				}
			}
		}
	}

	//If the agent is infected, check whether it is time for the agent to recover and if so,
	//uninfect it.
	if (agent.infected && agent.agentmap.state.ticks === agent.recovery_tick) {
		uninfectAgent(agent);
	}
}

function infectAgent(agent) {
	agent.infected = true,
	//Have the agent recover in a random number of ticks under 2000 from the time it is infected.
	agent.recovery_tick = agent.agentmap.state.ticks + Math.floor(Math.random() * 4000);
	agent.setStyle({color: "red"});

	agent.agentmap.infected_count++;
	updateEpidemicStats(agent.agentmap);
}

function uninfectAgent(agent) {
	agent.infected = false,
	agent.setStyle({color: "blue"});
	
	agent.agentmap.infected_count--;
	updateEpidemicStats(agent.agentmap);
}

//Infect a certain percent of the population, randomly.
function infect(agentmap, percent) {
	let number_of_infectees = Math.ceil(agentmap.agents.count() * percent),
	infectees = pick_random_n(agentmap.agents.getLayers(), number_of_infectees);
	infectees.forEach(infectee => infectAgent(infectee));
}

//Update the numbers in the display boxes in the HTML document.
function updateEpidemicStats(agentmap) {
	let infected_display = document.getElementById("infected_value");
	infected_display.textContent = agentmap.infected_count;

	let healthy_display = document.getElementById("healthy_value");
	healthy_display.textContent = agentmap.agents.count() - agentmap.infected_count;
}

function commuteToWork(agent) {
	agent.commuting_to = "work";
	
	//Schedule the agent to move to the center of its workplace and replace the currently scheduled trip.
	let workplace_unit = agent.agentmap.units.getLayer(agent.workplace_id);
	agent.setTravelToPlace(workplace_unit.getCenter(), {unit: agent.workplace_id}, 3, true);

	//Have the agent start its trip.
	agent.startTrip();
}

function commuteToHome(agent) {
	agent.commuting_to = "home";

	//Schedule the agent to move to the center of its home unit and replace the currently scheduled trip.
	let home_unit = agent.agentmap.units.getLayer(agent.home_id);
	agent.setTravelToPlace(home_unit.getCenter(), {unit: agent.home_id}, 3, true);

	//Have the agent start its trip.
	agent.startTrip();
}

//See whether the agent has arrived at its target place and mark its commute as ended.
function checkCommute(agent) {
	if ((agent.place.unit === agent.home_id && agent.commuting_to === "home") ||
		(agent.place.unit === agent.workplace_id && agent.commuting_to === "work")) {
		agent.commuting_to = null;
	}
}

//Given an array, return n random elements from it.
function pick_random_n(array, n) {
	if (array.length < n) {
		throw new Error("n cannot be bigger than the number of elements in the array!");
	}

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
