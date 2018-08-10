# AgentMaps Documentation

For a basic walkthrough on using AgentMaps, see [this](https://noncomputable.github.io/AgentMaps/#basic-walkthrough) section of the README.

The sidebar of this page contains a list of classes and namespaces used by Agentmaps. 
Click them to see their methods and properties, their purposes, and their intended types.
If you are looking at the [normal docs] (https://noncomputable.github.io/AgentMaps/docs),
you will only see the items necessary for using AgentMaps. However, if you are looking at
the [developer docs] (https://noncomputable.github.io/AgentMaps/devdocs/), you will see
everything, including functions used only in the internal implementation of AgentMaps.

Here I'll explain some features of AgentMaps that the auto-generated docs probably aren't sufficiently helpful to.

#### Table of Contents

[Basic Structure of Agentmaps](#basic-structure)
[Neighbors](#neighbors)
[Intersections](#intersections)
[AgentFeatureMakers](#agentfeaturemakers)

## Basic Structure

AgentMap functions as an extension of Leaflet. 
Since everything in Leaflet is in the L namespace (e.g. L.Map, L.latLng), everything in AgentMaps is in its own namespace A inside that namespace: L.A.

The main object of AgentMaps is an Agentmap (L.A.Agentmap).
Since AgentMaps is built on top of Leaflet, the Agentmap constructor requires a Leaflet map as an argument.
All the classes in AgentMaps have lowercase factory functions that return instances of them given their
constructor's arguments (L.A.agentmap).

The Agentmap keeps track of its units, streets, and agents as Leaflet FeatureGroups (Agentmap.units, Agentmap.streets, and Agentmap.agents).
These FeatureGroups can be looped through like any other Leaflet FeatureGroup (using the LayerGroup.eachLayer() method).

## Neighbors

Every unit has a neighbors property (unit.neighbors): a three element array of layer IDs representing the previous unit, the next unit, and the
unit directly across the street respectively.

## Intersections

Every street has an intersections property (street.intersections): an object mapping street IDs to an array of their intersections with the 
street in question, where the intersections themselves are 2-element arrays whose first elements are the coordinates of the intersections,
and whose second elements are the indices of the intersections in each street's own coordinate arrays. 

## AgentFeatureMakers


