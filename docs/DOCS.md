# AgentMaps Documentation

For a basic walkthrough on using AgentMaps, see [this](https://noncomputable.github.io/AgentMaps/#basic-walkthrough) section of the README.

The sidebar of this page contains a list of classes and functions used by Agentmaps. 
Click them to see their methods and properties, their purposes, and their types.
If you are looking at the [normal docs](https://noncomputable.github.io/AgentMaps/docs),
you will only see the items necessary for using AgentMaps. However, if you are looking at
the [developer docs](https://noncomputable.github.io/AgentMaps/devdocs/), you will see
everything, including functions used only in the internal implementation of AgentMaps.

Here I'll explain some features of AgentMaps that the auto-generated docs probably aren't sufficiently helpful for.

#### Table of Contents

[Basic Structure of Agentmaps](#basic-structure)

[Neighbors](#neighbors)

[Intersections](#intersections)

[AgentFeatureMakers](#agentfeaturemakers)

[Update Functions](#update-functions)

[Feature Styling](#feature-styling)

## Basic Structure

AgentMaps functions as an extension of Leaflet. 
Since everything in Leaflet is in the namespace L (e.g. L.Map, L.latLng), everything in AgentMaps is in its own namespace A inside of L, L.A (e.g. L.A.Agentmap, L.A.agent).

The main object of AgentMaps is an Agentmap (L.A.Agentmap).
Since AgentMaps is built on top of Leaflet, the Agentmap constructor requires a Leaflet map as an argument.
All the classes in AgentMaps have corresponding, lowercase factory functions that return new instances of them provided their
constructor's arguments. For example, `L.A.agentmap(map)` is equivalent to `new L.A.Agentmap(map)`.

An Agentmap stores its units, streets, and agents as Leaflet FeatureGroups (Agentmap.units, Agentmap.streets, and Agentmap.agents).
These FeatureGroups can be looped through like any other Leaflet FeatureGroup (using the LayerGroup.eachLayer() method).

## Neighbors

Every unit has a neighbors property (unit.neighbors): a three element array of layer IDs representing the previous unit, the next unit, and the
unit directly across the street respectively.

## Intersections

Every street has an intersections property (street.intersections): an object mapping the ID of another street the given street has intersections with to an array of the specific intersections. Each individual intersection itself is a 2-element array whose first element is the coordinates of the intersection,
and whose second element is an object mapping the ID of each street to the index of the intersection point in its coordinate array.

## AgentFeatureMakers

The `Agentmap.agentify` method creates and places agents on the map. Its first parameter is the number of agents to be created.
Its second parameter is a kind of function called an AgentFeatureMaker that specifies where the agents will be placed, what they look like, and what their properties are.
The AgentFeatureMaker you provide should behave as follows: given a number i, return a GeoJSON Point whose coordinates are where the agent should be placed, 
whose `properties.place` property is a valid [Place](https://noncomputable.github.io/AgentMaps/docs/global.html#Place) containing those coordinates,
whose `properties.layer_options` property is an object containing options for the agent's CircleMarker 
(like color, outline, radius, and all the other options listed [here](https://leafletjs.com/reference-1.3.2.html#circlemarker-option)). 
Any other properties defined in the `properties` property (like, say, `properties.phone_number`) will be transferred to a new Agent instance. 

For example, the AgentFeatureMaker in an epidemic simulation may return something like this:
```javascript
let feature = { 
	"type": "Feature",
	"properties": {
		"place": {
			"unit": random_unit_id
		},
		"layer_options": {
			"color": "blue",
			"radius": .5
		},
		"infected": Math.random() > .15 ? false : true,
		"ticks_until_recovery": Math.random() * 2000,
	},
	"geometry": {
		"type": "Point",
		"coordinates": center_coords
	},
};
```

## Update Functions

On each tick of the simulation, the Agentmap calls its own `Agentmap.update_func` and then each existing Agent's `Agent.update_func`, all of which are by default empty.
To specify what happens during your simulation, you should define update\_funcs where you need to.

If you want some event to happen that doesn't differ for different agents, I suggest specifying it in an `Agentmap.update_func`.

If you want some event to vary and occur at different times for different agents, I suggest generating varying `Agent.update_func`s in a loop like this:
```javascript
agentmap.agents.eachLayer(function(agent) {
	agent.update_func = function() {
		//custom operations that vary based on the given agent's properties
	}
});
```

\* I didn't follow this rule of thumb in the Basic Walkthrough to spice things up.

## Feature Styling

Every feature that AgentMaps places on the map is an instance of a Leaflet layer. Streets are L.Polylines, units are L.Polygons, and agents are L.CircleMarkers.

The methods for creating agents (agentify), units (buildingify), and streets (buildingify) provide options parameters to which you can pass a Leaflet options object 
specifying the style you want (colors, outlines, transparency, radius, etc.). 
See the [Leaflet docs](https://leafletjs.com/reference-1.3.2.html) for each of the aforementioned classes to learn about all the possible options. 

Buildingify's unit\_options parameter is different from the other options parameters: you can provide extra AgentMaps-only options to specify the length, depth, front-buffer (how far the front of a unit is from its street), and side-buffer (how far a unit is from adjacent units on the same street) of the unit in meters.

You can modify an individual street, unit, or agent's (Leaflet) style after it's already on the map by calling its setStyle method and passing it an options object.
