let path = require('ngraph.path');
let pathFinder = path.aStar(graph); // graph is https://github.com/anvaka/ngraph.graph

// now we can find a path between two nodes:
let fromNodeId = 40;
let toNodeId = 42;
let foundPath = pathFinder.find(fromNodeId, toNodeId);
// foundPath is array of nodes in the graph


//** using shortest path finder, convert OSM geojson data into weighted graph and find the shortest path between two pints **//
