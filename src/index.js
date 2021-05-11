/* This file is part of AgentMaps which is released under the Simplified BSD License. */

let agentmap = require('./agentmap'),
agents = require('./agents'),
buildings = require('./buildings'),
utils = require('./utils');

L.A = Object.assign({}, agentmap, agents, utils);
