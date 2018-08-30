# AgentMaps - Social Simulations on Interactive Maps

AgentMaps is a Javascript library for building and visualizing dynamic social systems on maps (or technically, "geospatial agent-based simulations").
It is based on the [Leaflet](https://leafletjs.com/) interactive mapping [library](https://github.com/Leaflet/Leaflet) and operates as an extension of it.
Given some information about a neighborhood, like a pair of points forming two corners of a rectangle that contains it and [GeoJSON](http://geojson.org/) data representing its streets,
AgentMaps lets you quickly and easily do the following:

* Generate buildings ("units") along the streets.
* Inspect and navigate between buildings and streets.
* Spawn agents and embed them into the map.
* Give agents rules of behavior.
* Schedule agents to move between units and streets ("places") on the map.
* Track the time and control the state of the simulation.

In short, it's something like a bare-bones SimCity factory.

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

First of all, you can find a bundle for AgentMaps here: <https://unpkg.com/agentmaps@2.0.0/site/dist/agentmaps.js>.

Making simulations with AgentMaps will be a lot easier for you if you can:

* Program with Javascript
* Use the [Leaflet](https://leafletjs.com/) mapping library

Leaflet doesn't come bundled with AgentMaps, so you'll have to either include it in your web page with its own \<script\> tag or
install it with [npm](https://www.npmjs.com/package/leaflet) and bundle it yourself.

It might also help to be familiar with [turf.js](http://turfjs.org/), a library that contains lots of tools that make geospatial work (like intersection detection and line slicing) quick and easy.

AgentMaps expects geographic data in the form of [GeoJSON](http://geojson.org/), a format for representing geospatial information, 
so it would be useful to take a look at that.

How do you get the GeoJSON data of some neighborhood you're interested in? I use [OpenStreetMap](https://www.openstreetmap.org/) (OSM), 
a free, collaborative map of the world! You can get a JSON file by using the "export" tool on the OSM website; 
you can also use it to get the coordinates of the two points bounding your neighborhood.

All of the above is pretty important to be able to contribute to AgentMaps or understand its internal implementation as well.

## Basic Walkthrough

Here, we'll walk through building a simple AgentMaps simulation. I suggest looking at the detailed [documentation](#documentation) for
all of the AgentMaps functions and classes used here to get a better understanding of how they work. 
If you're not so familiar with Leaflet, I suggest doing the same with the [Leaflet docs](https://leafletjs.com/reference-1.3.2.html).

First, create an HTML document that:
* Loads the Leaflet style and script
* Contains a \<div\> in which to insert the Leaflet map
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

Have two opposite corners of a rectangle containing the neighborhood of interest stored as an array of the corners' coordinates (i.e. [[lat, lon], [lat, lon]]):

```javascript
let bounding_points = [[43.3071, -88.0158], [43.2884, -87.9759]];
```

Create a Leaflet map in the "demo\_map" \<div\> of our HTML document:

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

For all the features of Agentmaps, look through the more detailed documentation discussed in the next section.

# Documentation

Documentation for people who want to use AgentMaps is available at <https://noncomputable.github.io/AgentMaps/docs/index.html>.

Documentation for people who want to contribute to AgentMaps or understand its internals is available here <https://noncomputable.github.io/AgentMaps/devdocs/index.html>.

# Demos

You can find a simple demo of AgentMaps, similar to the basic walkthrough, live [here](https://noncomputable.github.io/AgentMaps/demos/simple/simple.html).

You can find a more substantial demonstration of AgentMaps live [here](https://noncomputable.github.io/AgentMaps/demos/epidemic/epidemic.html).

You can find the corresponding code under /demos in the gh-pages branch [here](https://github.com/noncomputable/AgentMaps/tree/gh-pages/demos).

# Feature Wishlist

I've been stuffed with other work, so it'd be really cool if anyone wants to come along and help make AgentMaps better and more useful.
Here are some things I think would be great for AgentMaps to have. If you add them before I do, I'll credit your name appropriately.

* Sidewalks: streets and sidewalks should be divided and made into distinct places that agents can distinguish and navigate between.
* Architectural Variety: buildings vary in size, dimension, and shape a lot—they're not all identical rectangles. Users should be able
to provide custom building specifications and AgentMaps should materialize them.
  * For example, what if the GeoJSON the user provides contains a big park? The streets along it probably shouldn't be dotted with normal sized units—it should probably be one big unit itself!
* Urban Development: buildings change over time. Users should be able to specify these changes over time and AgentMaps should incorporate them coherently.
* Agent Diversity: agents are conveniently visualized with leaflet CircleMarkers and you can customize them a lot. But what if someone wants little human-shaped
sprites instead? Users should be able to specify Markers with custom images for the agents too.

# Authors

* Andrew - came up with & built AgentMaps

# Acknowledgements

I've only had a few extended conversations which involved me talking and thinking about this project outloud over the last few months, and those probably influenced how I went forward with it. The people I've had those discussions with are:

* I. ("Wheels") Errati
* M. ("dont ask me, ask gagan") Singh

Thank you to anyone who somehow benefits from this.
