# AgentMaps - Social Simulations on Interactive Maps

<img src="resources/agentgif.gif" width="500" height="387" />

AgentMaps is a Javascript library for building and visualizing dynamic social systems on maps.
It is based on the [Leaflet](https://leafletjs.com/) interactive mapping [library](https://github.com/Leaflet/Leaflet).
Given a neighborhood, AgentMaps lets you quickly and easily:

* Build units along the streets.
* Spawn agents onto the map.
* Schedule them to move between places on the map.
* Change their appearance and properties.

AgentMaps lets you turn this:

<img src="resources/noagentmaps.png" width="500" height="387" />

into something like this:

<img src="resources/agentmaps.png" width="500" height="387" />

You can install it via npm (`npm install agentmaps`) and bundle it yourself, or you can get a premade bundle [here](https://unpkg.com/agentmaps@2/site/dist/agentmaps.js) to include directly in a webpage. 
You'll need to [include Leaflet](https://leafletjs.com/download.html) separately.

### Documentation

Docs for people who want to use AgentMaps are available [here](https://noncomputable.github.io/AgentMaps/docs/index.html).

Docs people who want to understand its internals are [here](https://noncomputable.github.io/AgentMaps/devdocs/index.html).

A basic walkthrough for creating an AgentMaps simulation can be found [here](https://noncomputable.github.io/AgentMaps/docs/tutorial-quickstart.html). 

### Demos

[Simple](https://noncomputable.github.io/AgentMaps/demos/simple/simple.html): Shows all the different ways agents can travel around a map.

[Epidemic](https://noncomputable.github.io/AgentMaps/demos/epidemic/epidemic.html): Agents commute between different parts of a neighborhood while an infection spreads between them.

You can find the corresponding code under _/demos_ in the gh-pages branch [here](https://github.com/noncomputable/AgentMaps/tree/gh-pages/demos).

### Authors

* Andrew - came up with & built AgentMaps

## Acknowledgements 

This project is based on my study of social simulation with [Jennifer Mangels](https://www.gc.cuny.edu/Page-Elements/Academics-Research-Centers-Initiatives/Doctoral-Programs/Psychology/Faculty-Bios/Jennifer-Mangels) at the [Dynamic Learning Lab](http://www.mangelslab.org/). I was simulating epidemics on my desktop and thought it'd be great to do on a real neighborhood and share it with others. It turned out that wasn't feasible! So after some discussion with Professor Mangels, I decided to work on AgentMaps, to solve the problem of making accessible, map-based agent simulations. Her guidance and discussions during our independent study were a serious influence on this project.

And thank you to Ilias Errati, Md Malsi, Dillion Verma, and Manny Singh for discussions which probably influenced the direction and development of AgentMaps.

Thank you to anyone who somehow benefits from this.

**AgentMaps: Geospatial Agent-based Modeling and Simulation for JavaScript.**
