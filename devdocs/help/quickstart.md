Here we'll walk through building a simple AgentMaps simulation. I suggest looking at the detailed [documentation](./) for
all of the AgentMaps functions and classes used here to get a better understanding of how they work. 
If you're not so familiar with Leaflet, I suggest doing the same with the [Leaflet docs](https://leafletjs.com/reference-1.3.2.html).

You'll need AgentMaps, which you can get in a bundle [here](https://unpkg.com/agentmaps@2/site/dist/agentmaps.js) or install via npm (`npm install agentmaps`). You'll also need the Leaflet script and style files, which you can get [here](https://leafletjs.com/download.html).

First, create an HTML document that:
* Loads the Leaflet.js style and script
* Contains a `<div>` in which to embed the Leaflet map
* Loads the AgentMaps script at the end

```HTML
<!DOCTYPE HTML>
<html>
<head>
<link rel="stylesheet" href="leaflet_style.css">
<script src="leaflet_script.js"></script>
</head>
<body>
<div id="demo_map" style="height:400px"></div>
<script src="agentmaps.js"></script>
</body>
</html>
```

Assume we have the GeoJSON of a neighborhood stored in a variable like this, where the ellipses stand in for a list of map features (like streets):

```javascript
let map_data = {
	"type": "FeatureCollection",
	"features": [
		...
		...
		...
	]
};
```

You can use the sample data from the demos [here](../resources/map_data.js).

Have the top left and bottom right corners of a rectangle containing the neighborhood stored as an array of the corners' coordinates (i.e. [[lat, lon], [lat, lon]]):

```javascript
let bounding_points = [[39.9058, -86.0910], [39.8992, -86.1017]]; 
```

Create a Leaflet map in the "demo\_map" `<div>` of our HTML document:

```javascript
let map = L.map("demo_map").fitBounds(bounding_points);
```

The map will be empty, so tile it with OpenStreetMap's map tiles to see what's where:

```javascript
L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
	}
).addTo(map);
```

Now that we have our map in place and the geographic data for our neighborhood in hand, create an Agentmap from the map:

```javascript
let agentmap = L.A.agentmap(map);
```

Now generate buildings and functional roads on the map based on the geographic data:

```javascript
agentmap.buildingify(map_data, bounding_points);
```

Now you can place agents on the map according to the rules of a custom agentFeatureMaker function. We'll use the built-in seqUnitAgentMaker,
which just assigns a number to each agent it generates in sequence, counting up from 0 to the number of agents you want, and places each agent 
in the center of the unit with the same index as that number in the list of units. We'll make 50:

```javascript
agentmap.agentify(50, agentmap.seqUnitAgentMaker);
```

The simulation will start once we call `agentmap.run()`. The simulation is divided into consecutive "ticks", starting at tick 0.
On each tick, the following happens:
* The Agentmap runs its user-defined `Agentmap.controller()` (which we haven't defined yet)
* Each agent runs its own user-defined `Agent.controller()` (we'll leave that empty)
* Before and after each step an agent takes during the tick, it runs its own user-defined `Agent.fine_controller()` (we'll leave that empty too)

The number of ticks elapsed at any point in the simulation is set in `agentmap.state.ticks`, functioning as a kind of clock. 
We can call `agentmap.pause()` to stop the simulation, during which the ticks elapsed won't change, and then `agentmap.run()` to continue it.

So, let's define a controller function for our Agentmap:

```javascript
agentmap.controller = function() {

};
```

What do we want to happen on each tick? That is, what will we put in the controller function's body?
A simple simulation will involve the agents moving to a random unit every 300 ticks.

So first, we will have the `Agentmap.controller` check if the current number of ticks is a multiple of 300,
as we only want anything to happen every 300 ticks:

```javascript
if (agentmap.state.ticks % 300 === 0) {

}
```

Then, if number of ticks _is_ a multiple of 300, we want to tell each agent to do something,
so we will set up a loop that operates on each agent:

```javascript
agentmap.agents.eachLayer(function(agent) {
	
}
```

Now, for each agent, we'll generate a random number between 0 and the total number of units, and
store the unit whose index is that number, its ID, and the coordinates of its center:

```javascript
let random_index = Math.floor(agentmap.units.count() * Math.random()),
random_unit = agentmap.units.getLayers()[random_index],
random_unit_id = agentmap.units.getLayerId(random_unit),
random_unit_center = random_unit.getBounds().getCenter();
```

Then we will schedule for the agent a trip to that unit's center at approximately 1 meter per tick:

```javascript
agent.scheduleTrip(random_unit_center, {type: "unit", id: random_unit_id}, 1, false, true);
```

We want the agent to move along whatever path it has scheduled at each tick, so we will add the following to the end of our
controller function, outside of the 300 tick condition:

```javascript
agent.moveIt();
```

Altogether, our Agentmap's controller will look like this:

```javascript
agentmap.controller = function() {
	if (agentmap.state.ticks % 300 === 0) {
		agentmap.agents.eachLayer(function(agent) {
			let random_index = Math.floor(agentmap.units.count() * Math.random()),
			random_unit = agentmap.units.getLayers()[random_index],
			random_unit_id = agentmap.units.getLayerId(random_unit),
			random_unit_center = random_unit.getBounds().getCenter();

			agent.scheduleTrip(random_unit_center, {type: "unit", id: random_unit_id}, false, true);
		}
	}

	agent.moveIt();
}
```

Finally, now that we've got our Agentmap, buildings and agents loaded, and a controller defined, we can add:

```javascript
agentmap.run();
```

Once we load our HTML document, the simulation should begin and we can watch our agents move around the neighborhood.
