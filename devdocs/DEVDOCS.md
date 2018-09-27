# AgentMaps Documentation

The sidebar of this page contains a list of classes and functions used by Agentmaps. 
Click them to see their methods and properties, their purposes, and their types.
If you are looking at the [normal docs](https://noncomputable.github.io/AgentMaps/docs),
you will only see the items necessary for using AgentMaps. However, if you are looking at
the [developer docs](https://noncomputable.github.io/AgentMaps/devdocs/), you will see
everything, including functions used only in the internal implementation of AgentMaps.

Here I'll explain some features of AgentMaps that the auto-generated docs probably aren't sufficiently helpful for.

#### Table of Contents

[Prerequisites](#prerequisites)

[Basic Structure of Agentmaps](#basic-structure)

[Generating Buildings](#generating-buildings)

[Navigating Streets](#navigating-streets)

[Navigating Within Units](#navigating-within-units)

[Feature Styling](#feature-styling)

[Neighbors](#neighbors)

[Intersections](#intersections)

[AgentFeatureMakers](#agentfeaturemakers)

[Moving To Places](#moving-to-places)

[Controllers](#controllers)

[Animation Speed](#animation-speed)

## Prerequisites

You can find a bundle for AgentMaps here: <https://unpkg.com/agentmaps@2/site/dist/agentmaps.js>.

Making simulations with AgentMaps will be a lot easier for you if you can:

* Program with Javascript
* Use the [Leaflet](https://leafletjs.com/) mapping library

Leaflet doesn't come bundled with AgentMaps, so you'll have to either include it in your web page with its own `<script\>` tag or
install it with [npm](https://www.npmjs.com/package/leaflet) and bundle it yourself.

It might also help to be familiar with [turf.js](http://turfjs.org/), a library that contains lots of tools that make geospatial work (like intersection detection and line slicing) quick and easy.

AgentMaps expects geographic data in the form of [GeoJSON](http://geojson.org/), a format for representing geospatial information, 
so it would be useful to take a look at that.

How do you get the GeoJSON data of some neighborhood you're interested in? I use [OpenStreetMap](https://www.openstreetmap.org/) (OSM), 
a free, collaborative map of the world! You can get an OSM file by using the "export" tool on the OSM website; 
you can also use it to get the coordinates of the two points bounding your neighborhood. Then, using [OSMToGeoJSON](https://tyrasd.github.io/osmtogeojson/),
you can plug in your OSM file and get the JSON in return.

All of the above is pretty important to be able to contribute to AgentMaps or understand its internal implementation as well.

## <a name="basic-structure"></a>Basic Structure

AgentMaps functions as an extension of [Leaflet](https://github.com/Leaflet/Leaflet). 
Since everything in Leaflet is in the namespace `L` (e.g. `L.Map`, `L.latLng`), everything in AgentMaps is in its own namespace `A` inside of `L`, `L.A` (e.g. `L.A.Agentmap`, `L.A.agent`).

The main object of AgentMaps is an Agentmap ([L.A.Agentmap](./Agentmap.html)).
Since AgentMaps is built on top of Leaflet, the Agentmap constructor requires a Leaflet map as an argument.
All the classes in AgentMaps have corresponding, lowercase factory functions that return new instances of them provided their
constructor's arguments. For example, `L.A.agentmap(map)` is equivalent to `new L.A.Agentmap(map)`.

An Agentmap stores its units, streets, and agents as Leaflet [FeatureGroups](https://leafletjs.com/reference-1.3.4.html#featuregroup) (`Agentmap.units`, `Agentmap.streets`, and `Agentmap.agents`).
These FeatureGroups can be looped through like any other Leaflet FeatureGroup (using the [FeatureGroup.eachLayer()](https://leafletjs.com/reference-1.3.4.html#featuregroup-eachlayer) method).

## <a name="generating-buildings"></a>Generating Buildings

To setup an Agentmap and build its streets and units, you need to provide some information about the neighborhood of interest:
* [GeoJSON](http://geojson.org/) data representing its streets
* The coordinates of the top left and bottom right corners of a rectangle containing the neighborhood, LatLng order

You can get this information with both the OpenStreetMap [web interface](http://openstreetmap.org) and its [Overpass API](http://overpass-api.de). For converting between formats, you can use [OSMToGeoJSON](https://tyrasd.github.io/osmtogeojson/).

The [Agentmap.buildingify](./Agentmap.html#buildingify) method does this work. If the GeoJSON data for the neighborhood is
stored in a variable `my_data` and the coordinates of the top left and bottom right corners of the bounding rectangle are `[43.3071, -88.0158]` and `[43.2884, -87.9759]` respectively, the corresponding call to `Agentmap.buildingify` would look something like:

```javascript
agentmap.buildingify(my_data, [[43.3071, -88.0158], [43.2884, -87.9759]]);
```
`Agentmap.buildingify` accepts more arguments specifying the dimension and appearance of the units and streets it will build. For more on that, see the section on [Feature Styling](#feature-styling).

`Agentmap.buildingify` does a lot of work checking for and removing overlapping units, and so the bigger your neighborhood, the noticeably longer it will take. 
To compensate for this and help make your simulation more responsive, `Agentmap.buildingify`'s last two parameters, after the styling options, accept a `unit_layers` object and `street_layers` object respectively: a GeoJSON FeatureGroup of units or streets exported from a previous AgentMaps simulation. 
If either of these is passed as an argument, instead of generating the unit or street layers from scratch, `Agentmap.buildingify` will more quickly just use the blueprints in `unit_layers` and `street_layers`.

How do you get a `unit_layers` or `street_layers` object? Agentmaps have an 
[Agentmap.downloadUnits](./Agentmap.html#downloadUnits) method and a [Agentmap.downloadStreets](./Agentmap.html#downloadStreets)
method which, when called, will generate a *js* file containing a single variable named `unit_data` or `street_data` defined as the vale of `Agentmap.units.toGeoJSON(20)` or `Agentmap.streets.toGeoJSON(20)` respectively.

What if your OSM street data is too big for a browser to feasibly generate all the appropriate building layers?
The npm package comes with a command line tool named "featuretool" which, given the bounding coordinates and path to a file containing OSM-style GeoJSON, generates all the appropriate layers and exports them to files similar to those that `Agentmap.downloadUnits` and `Agentmap.downloadStreets` generate.
To use it, you need to have installed AgentMaps globally with `npm install -g AgentMaps`.

To use featuretool, you'd do something like this:
```shell
featuretool --bbox [[39.9058,-86.0910],[39.8992,-86.1017]] --streets data/townmap.js
```
## <a name="navigating-streets"></a>Navigating Streets

Given a neighborhood's streets in GeoJSON, AgentMaps extracts a street network and converts it to a [graph](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics) with the help of the [ngraph.graph](https://github.com/anvaka/ngraph.graph) library. Then, it uses [ngraph.path](https://github.com/anvaka/ngraph.path) to find an (approximately) shortest path. The graph itself is made out of the start point, end point, and intersections of each street.

The graph is stored in the `Agentmap.streets.graph` property. It is a symmetric graph; for each edge between two points, an inversely directed edge between them also exists. That is, by default, there are no one-way streets. However, if you'd like to remove some of the directed edges of certain streets from the graph (i.e. for making one-way streets), a very accessible guide to manipulating the graphs is available in the ngraph.graph [README](https://github.com/anvaka/ngraph.graph/blob/master/README.md).

## <a name="navigating-within-units"></a>Navigating Within Units

Every Agentmap has an [Agentmap.getUnitPoint](./Agentmap.html#.getUnitPoint) method which makes it easy to specify a position inside of a unit, relative to one of its corners, and get back the global coordinates of that spot. 

Given a unit ID, an x value between 0 and 1, and a y value between 0 and 1, `Agentmap.getUnitPoint` will get a position down the width and into the depth of a unit according to the supplied x and y values, and return the global coordinates of the position it lands on.
More specifically, starting from the front corner of the unit that comes first along its street, getUnitPoint will effectively return a [LatLng](./Global.html#LatLng) representing the position x * 100 percent along its width and y * 100 percent into its depth.

## <a name="feature-styling"></a>Feature Styling

Every feature that AgentMaps places on the map is an instance of a Leaflet layer. Streets are L.Polylines, units are L.Polygons, and agents are L.CircleMarkers.

The methods for creating agents ([agentify](./Agentmap.html#agentify)), units ([buildingify](./Agentmap.html#buildingify)), and streets (buildingify) provide options parameters to which you can pass a Leaflet options object 
specifying the style you want (colors, outlines, transparency, radius, etc.). 
See the [Leaflet docs](https://leafletjs.com/reference-1.3.2.html) for each of the aforementioned classes to learn about all the possible options.

An options object may look something like this:

```javascript
let options = {
	radius: .5,
	color: "pink",
	weight: 3,
	opacity: .5
};
```

Buildingify's unit\_options parameter is different from the other options parameters: you can provide extra AgentMaps-only options to specify the length, depth, front-buffer (how far the front of a unit is from its street), and side-buffer (how far a unit is from adjacent units on the same street) of the units in meters.

You can modify an individual street, unit, or agent's (Leaflet) style after it's already on the map by calling its [setStyle](https://leafletjs.com/reference-1.3.4.html#path-setstyle) method and passing it an options object.

## <a name="neighbors"></a>Neighbors

Every unit has a neighbors property, `unit.neighbors`: a three element array of layer IDs representing the previous unit, the next unit, and the
unit directly across the street respectively.

## <a name="intersections"></a>Intersections

Every street has an intersections property (street.intersections): an object mapping the ID of another street the given street has intersections with to an array of the specific intersections. Each individual intersection itself is a 2-element array whose first element is the coordinates of the intersection,
and whose second element is an object mapping the ID of each street to the index of the intersection point in its coordinate array.

Here's an example of a street.intersections object:

```javascript
street.intersections = {
  "68": [
    [
      {
        "lat": 40.64315,
        "lng": -73.522418
      },
      {
        "57": 36,
        "68": 48
      }
    ],
    [
      {
        "lat": 40.64355,
        "lng": -73.523129
      },
      {
        "57": 32,
        "62": 9
      }
    ]
  ],
  "61": [
      {
        "lat": 40.646255,
        "lng": -73.524835
      },
      {
        "57": 23,
        "61": 0
      }
   ]
};
```

## <a name="agentfeaturemakers"></a>AgentFeatureMakers

The `Agentmap.agentify` [method](./Agentmap.html#agentify) creates and places agents on the map. Its first parameter is the number of agents to be created.
Its second parameter is a kind of function called an [AgentFeatureMaker](./global.html#agentFeatureMaker) that specifies where the agents will be placed, what they look like, and what their properties are.

The AgentFeatureMaker you provide should behave as follows: given the leaflet ID of the agent, return a GeoJSON Point feature whose coordinates are where the agent should be placed, 
whose `properties.place` property is a valid [Place](https://noncomputable.github.io/AgentMaps/docs/global.html#Place) containing those coordinates,
and whose `properties.layer_options` property is an object containing options for the agent's CircleMarker 
(like color, outline, radius, and all the other options listed [here](https://leafletjs.com/reference-1.3.2.html#circlemarker-option)). 
Any other properties defined in the `properties` property (like, say, `feature.properties.phone_number`) will be transferred to a new Agent instance. 

For example, the AgentFeatureMaker in an epidemic simulation may look something like this:
```javascript
function epidemicAgentMaker = function(id) {
	let feature = { 
		"type": "Feature",
		"properties": {
			"place": {
				"type": "unit",
				"id": random_unit_id
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

	return feature;
}
```

The corresponding call to `Agentmap.agentify` might look something like this:
```javascript
agentmap.agentify(100, epidemicAgentMaker);
```
## <a name="moving-to-places"></a>Moving To Places

The agents' [Agent.scheduleTrip](./Agent.html#.scheduleTrip) method makes scheduling trips between any places on the map very convenient. 
`Agent.scheduleTrip` works by keeping track of the kind of place the agent is at and is going to at any given time. The [place](./global.html#Place)
can be either a unit, a street,
or "unanchored", meaning anywhere on the map with no relation to whatever features (streets or units) may or may not be there. 

Depending on where an agent is, and where it intends to travel to, the agent will travel in different ways. 
If it's leaving from or going to an unanchored place, it will ignore the roads and travel directly. 
If it's moving between streets or units, it will by default move along the roads and in and out through the front ("doors") of the units.

To schedule an agent to move somewhere, all you need to do is give `Agent.scheduleTrip` two arguments: the coordinates of where you want the agent to go and a [Place](./global.html#Place) object describing what's there.
Optionally you can provide three more arguments: 
* A custom speed greater than or equal to .1 (1 by default)
* A true/false value specifying whether the agent should ignore the roads and move directly to its goal (false by default, and redundant if the agent is moving from or going to an unanchored place) 
* A true/false value specifying whether the agent should give up on its current trip, emptying its schedule (false by default).

Beyond just scheduling an agent to move somewhere, for information about actually _making_ it move, see the section on [controllers](#controllers).

*Note*: Over long distances, as agent movements aren't precise enough for multi-hundred mile paths to slope properly, the agent's path may be very roundabout.

## <a name="controllers"></a>Controllers

What actually happens on the Agentmap and to each Agent is determined by the controller functions you define. On each tick of the simulation, the Agentmap calls its own `Agentmap.controller` and then each existing Agent's `Agent.controller`, all of which are by default empty.

Whatever trip an Agent has scheduled (with `Agent.scheduleTrip`), it will only actually move when its `Agent.moveIt` method is called (usually by its controller function). 
You can place the call to `Agent.moveIt` anywhere within the controller function depending on what (if anything) you want to have happen before or after the agent moves.

Since on each tick, an Agent will move according to the speed specified by the next point in its scheduled path, you may have an Agent move a large distance per tick, and only be able to access its position before and after you make the movement (by calling Agent.moveIt) within the controller function. If you would like more precision, at the cost of some performance, you can define an `Agent.fine_controller` function, which is called before and after each individual step an Agent makes (approximately half a meter).

To specify what happens during your simulation, you should define controllers where you need to.

If you want some event to happen that doesn't differ for different agents, I suggest specifying it in an `Agentmap.controller`.

If you want some event to vary and occur at different times for different agents, I suggest generating varying `Agent.controller`s in a loop like this:
```javascript
agentmap.agents.eachLayer(function(agent) {
	agent.controller = function() {
		//custom operations that vary based on the given agent's properties
	}
});
```
\* I didn't follow this rule of thumb in the Basic Walkthrough to spice things up.

You can start, pause, and resume an AgentMaps simulation using the [Agentmap.run](./Agentmap.html#.run) and [Agentmap.pause](./Agentmap.html#.pause) methods. When `Agentmap.run` is called, 
the Agentmap and Agents will run their controller functions, the Agentmap will increment its tick clock (`Agentmap.state.ticks`), 
and a new animation frame will be requested to do the same thing over again.

After `Agentmap.pause()` is called, the tick will not be incremented, the request for the next animation frame will be cancelled, and the controller functions will stop being called. Calling `Agentmap.run()` after pausing will set things back in motion.

[Agentmap.clear](./Agentmap.html/clear) will reset the Agentmap's state (including the tick counter) and remove all the AgentMaps layers from the map.

## <a name="animation-speed"></a>Animation Speed

You can pause or resume an Agent's trip with its [Agent.pauseTrip](./Agent.html#.pauseTrip) and [Agent.resumeTrip](./Agent.html#.resumeTrip) methods. You can also alter the speeds an Agent is scheduled to travel using several methods: [Agent.setSpeed](./Agent.html#.increaseSpeed), [Agent.multiplySpeed](./Agent.html#.multiplySpeed), and [Agent.increaseSpeed](./Agent.html#.increaseSpeed). But that's not the kind of speed this section is about.

Time in an Agentmap is measured by ticks (recorded in `Agentmap.state.ticks`). A tick can be interpreted differently based on what you have Agents do on each tick: it can be a second, a minute, an hour, or something less standard. But how long does it take for a tick to elapse in real life; that is, how long will your computer take to complete the operations that should happen during a tick?

Typically, it's a few miliseconds. But the more Agents you have and the more complex instructions you give them, the longer it'll take, and the slower your simulation will run. The biggest drain on speed is animation: drawing and redrawing tens or hundreds of Agents everytime they take a tiny step takes a lot of resources and a (relatively) long time.

To help deal with this, an Agentmap's constructor, along with a Leaflet map, accepts an "animation\_interval" argument, a nonnegative integer. An Agent will only be animated every `Agentmap.animation_interval` steps, where a step is typically less than a meter. 

By default, it is 1, meaning it will be redrawn after every step. The higher the value, the choppier the animation will look, but the faster it should proceed. 

Zero is a special value: if `Agentmap.animation_interval` is 0, then the animation will stop completely while the simulation continues under-the-hood.

You can also change the `animation_interval` after creating the Agentmap with the [Agentmap.setAnimationInterval](./Agentmap.html#setAnimationInterval) method.
