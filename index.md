# AgentMaps - Simulate Societies on Web Maps

AgentMaps is a Javascript framework for building and visualizing geospatial agent-based simulations.
It is based on the [Leaflet](https://leafletjs.com/) interactive mapping [library](https://github.com/Leaflet/Leaflet) and functions as an extension of it.
Given some information about a neighborhood, like a pair of points containing it and [GeoJSON](http://geojson.org/) data representing its streets,
AgentMaps lets you quickly and easily do the following:

* Generate buildings ("units") along the streets.
* Inspect and navigate between buildings and streets.
* Generate agents and embed them into the map in a custom way.
* Schedule agents to move between units and streets ("places").
* Track the time and control the state of the simulation.

In short, it's something like a bare-bones SimCity generator.

#### Table of Contents
[Prerequisites](#prerequisites)

[Basic Walkthrough](#basic-walkthrough)

[Documentation](#documentation)

[Demos](#demos)

[Feature Wishlist](#feature-wishlist)

[Authors](#authors)

[Acknowledgements](#acknowledgements)

# Getting Started

## Prerequisites

First of all, you can find a bundle for AgentMaps here: <https://unpkg.com/agentmaps@1/dist/agentmaps.js>.

Making simulations with AgentMaps will be a lot easier for you if you have a good understanding of the following:

* Basic Javascript!
* Using [Leaflet](https://leafletjs.com/)

Leaflet doesn't come bundled with AgentMaps, so you'll have to either include it in your web page with its own \<script\> tag or
install it with [npm](https://www.npmjs.com/package/leaflet). Everything in AgentMaps exists within Leaflet's L namespace as L.A,
so AgentMaps classes and functions are accessed with L.A.ClassName and L.A.functionName repsectively.

It might also help you to be familiar with [turf.js](http://turfjs.org/), a library that contains lots of tools which make geospatial computations (like intersection detection and line slicing) quick and easy.

AgentMaps expects geographic data in the form of [GeoJSON](http://geojson.org/), a data format for representing geospatial information, 
so it might be useful to take a look at that. You don't really need to handle GeoJSON directly to use AgentMaps, though.

How do you get the GeoJSON data of some neighborhood you're interested in? I use [OpenStreetMap](https://www.openstreetmap.org/) (OSM), 
a free, collaborative map of the world! You can get a JSON file by using the "export" tool on the OSM website; 
you can also use it to get the coordinates of the two points bounding your neighborhood.

All of the above is pretty important to be able to contribute to AgentMaps or understand its internal implementation as well.

## Basic Walkthrough

Here, we'll walk through building a simple AgentMaps simulation. I suggest looking at the detailed [documentation](#documentations) for
all of the AgentMaps functions and classes used here to get a better understanding of how they work, what kinds of input they expect, and
what you can expect them to do in response. If you're not so familiar with Leaflet, I suggest doing the same with the [Leaflet docs](https://leafletjs.com/reference-1.3.2.html).

Create an HTML document that loads the Leaflet stylesheet and script, contains a \<div\> in which to insert the Leaflet map, and
loads AgentMaps at the end:

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

Have the two corners of a rectangle containing the neighborhood of interest stored as an array of their coordinates, [longitude, latitude]:

```javascript
let bounding_points = [[43.3071, -88.0158], [43.2884, -87.9759]];
```

Create a Leaflet map in the demo\_map \<div\> of our HTML document:

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

Now generate buildings and functional roads on the map based on that geographic data:

```javascript
agentmap.buildingify(map_data, bounding_points);
```

Now you can spawn agents onto the map according to the rules of a custom agentFeatureMaker function. We'll use the built-in seqUnitAgentMaker,
which just assigns a number to each agent it generates in sequence, counting up from 0 to the number of agents you want, and placing each agent 
in the center of the unit whose ID is the corresponding number. We'll make 50:

```javascript
agentmap.agentify(50, agentmap.seqUnitAgentMaker);
```

The Agentmap simulation will start once we call `agentmap.run()`. From then on, its operation is divided up into consecutive "ticks".
At each tick, each agent moves further along its scheduled path (for now, we haven't scheduled anything for our agents) and the agentmap 
runs the `agentmap.update_func()` that we can define (we we haven't done yet). 
The ticks are identified by a number, starting from 0, and each next tick is 1 greater.
The tick at any point in the simulation is set in `agentmap.state.ticks` and it functions as a kind of clock. 
We can call `agentmap.pause()` to stop the simulation, during which the ticks elapsed won't change, and then `agentmap.run()` to continue it.

So, let's define an update function:

```javascript
agentmap.update_func = function() {

};
```

What do we want to do on each tick? That is, what will we put in the function body?
A simple simulation might involve the agents moving to a random unit every 300 ticks.

So first, we will have the update\_func check if the current number of ticks is a multiple of 300,
as we only want to do anything every 300 ticks:

```javascript
if (agentmap.state.ticks % 300 === 0) {

}
```

Then, if the tick is a multiple of 300, we want to tell each agent to do something,
so we will set up a loop that goes through and operates on each agent:

```javascript
agentmap.agents.eachLayer(function(agent) {
	
}
```

Now, for each agent, we'll generate a random number between 0 and the greatest unit index and
store the unit with that index, its ID, and the coordinates of its center:

```javascript
let random_index = Math.floor(agentmap.units.count() * Math.random()),
random_unit = agentmap.units.getLayers()[random_index],
random_unit_id = agentmap.units.getLayerId(random_unit),
random_unit_center = random_unit.getBounds().getCenter();
```

Then we will tell the agent to stop whatever it's doing and start traveling to that unit's center:

```javascript
agent.setTravelToPlace(random_unit_center, {"unit": random_unit_id}, true);
agent.startTrip();
```

Altogether, our update\_func will look like this:

```javascript
agentmap.update_func = function() {
	if (agentmap.state.ticks % 300 === 0) {
		agentmap.agents.eachLayer(function(agent) {
			let random_index = Math.floor(agentmap.units.count() * Math.random()),
			random_unit = agentmap.units.getLayers()[random_index],
			random_unit_id = agentmap.units.getLayerId(random_unit),
			random_unit_center = random_unit.getBounds().getCenter();

			agent.setTravelToPlace(random_unit_center, {"unit": random_unit_id}, true);
			agent.startTrip();
		}
	}
}
```

Finally, now that we've got our Agentmap in place, buildings and agents loaded, and update\_func defined, we can add:

```javascript
agentmap.run();
```

Once we load our HTML document, the simulation should begin and we can watch our agents moving about the neighborhood.

For all the features of Agentmaps, look through the docs discussed in the next section.

# Documentation

Documentation for all the necessary features for people who want to use AgentMaps is available at <https://noncomputable.github.io/AgentMaps/docs/index.html>.

Documentation for people who want to contribute to AgentMaps or understand its internals is available here <https://noncomputable.github.io/AgentMaps/devdocs/index.html>.

# Demos

You can find a simple demo of AgentMaps, similar to the basic walkthrough, live [here](https://noncomputable.github.io/AgentMaps/demos/simple/simple.html).
You can find a slightly more substantial demonstration of AgentMaps live [here](https://noncomputable.github.io/AgentMaps/demos/epidemic/epidemic.html).
You can find the corresponding code under /demos in the gh-pages branch [here](https://github.com/noncomputable/AgentMaps/tree/gh-pages/demos).

# Feature Wishlist

I've been stuffed with other work, so it'd be really cool if anyone wants to come along and help make AgentMaps better and more useful.
Here are some things I think would be great for AgentMaps to have. If you add them before I do, I'll credit your name next to them.

* Sidewalks: streets and sidewalks should be divided and made into distinct places that agents can distinguish and navigate between.
* Architectural Variety: buildings vary in size, dimension, and shape a lot——they're not all identical rectangles. Users should be able
to specify these customizations and AgentMaps should be able to generate and embed them appropriately.
  * For example, what if the GeoJSON the user provides contains a big park? The street parallel to it probably shouldn't be dotted with normal sized units——it should probably be one big unit itself!
* Urban Development: buildings, streets, and sidewalks change over time! Users should be able to easily specify these changes and AgentMaps should be able to
incorporate them coherently.
* Optimization: 
  * Make utilities for running spatial computations on agents and buildings faster. Otherwise users may tend to default to naive implementations that hinder them from be able to do what they want to do. 

# Authors

* Andrew - Came up with AgentMaps.

# Acknowledgements

I've only had a few extended conversations which involved me talking and thinking about this project outloud over the last few months, and those probably influenced how I went forward with it. The people I've had those discussions with are:

* I. ("Wheels") Errati
* G. ("help me fix gh-pages") Jello
* M. Singh

Thank you to anyone who somehow benefits from this.
