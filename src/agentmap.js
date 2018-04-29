/**
 * The main class for building, storing, simulating, and manipulating agent-based models on Leaflet maps.
 *
 * @class Agentmap
 * @param {object} map - A Leaflet Map object.
 * @property {object} map - A Leaflet Map object.
 * @property {object} layers - Leaflet layers for units, streets, and agents. 
 * @property {Agent} agents - An array of all agents in the map.
 * @property {object} process_state - Properties detailing the state of the simulation process.
 * @property {boolean} process_state.running - Whether the simulation is running or not.
 * @property {boolean} process_state.paused - Whether the simulation is paused.
 * @property {?number} process_state.animation_frame_id - The id of the agentmap's update function in the queue of functions to call for the coming animation frame.
 * @property {?number} process_state.current_tick - The number of ticks elapsed since the start of the simulation.
 * @property {?number} process_state.prev_tick - The tick (time in seconds) when the last update was started.
 * @property {?number} process_state.tick_start_delay - Ticks corresponding to the time of the last animation frame before the trip started. Subtracted from all subsequent tick measurements so that the clock starts at 0, instead of whatever the actual time of that initial animation frame was.
 */
function Agentmap(map) {
	this.map = map;
	this.layers = {
		units: null,
		streets: null,
		agents: L.geoJSON(
				null,
				{
					pointToLayer: function(feature, latlng) {
						return L.circleMarker(latlng, {radius: .5, color: "red", fillColor: "red", renderer: L.canvas()});
					}
				}
			).addTo(this.map)
	},
	this.agents = [],
	this.process_state = {
		running: false,
		paused: false,
		animation_frame_id: null,
		current_tick: null,
		prev_tick: null,
		tick_start_delay: null
	},
	this.settings = {
		movement_precision: .001
	}
}

Agentmap.prototype.Agent = Agent,
Agentmap.prototype.agentify = agentify,
Agentmap.prototype.seqUnitAgentMaker = seqUnitAgentMaker,
Agentmap.prototype.buildingify = buildingify,
Agentmap.prototype.getUnitDoor = getUnitDoor;

/**
 * Get an animation frame, have the agents update & get ready to be drawn, and keep doing that until paused or reset.
 */
Agentmap.prototype.run = function() {
	if (this.process_state.running === false) {
		this.process_state.running = true;
		
		let animation_update = (function (rAF_time) {
			this.update(rAF_time);
			
			this.process_state.animation_frame_id = requestAnimationFrame(animation_update);
		}).bind(this);

		this.animation_frame_id = requestAnimationFrame(animation_update);
	}
}

/**
 * Update the simulation at the given time.
 *
 * @param {number} rAF_time - Time passed by the browser's most recent animation frame.
 */
Agentmap.prototype.update = function(rAF_time) {
	let total_ticks = rAF_time * .001,
	tick_at_pause = 0,
	ticks_since_paused = 0;
	
	if (this.process_state.current_tick === null) {
		this.process_state.current_tick = 0,
		this.process_state.prev_tick = 0,

		//requestAnimationFrame doesn't start with timestamp 0; the first timestamp will typically be pretty large; 
		//we want to store it and subtract it from each newly recieved tick at which we're animating so that ticks 
		//are counted from 0, not whatever timestamp the original call to rAF happened to return. 
		this.process_state.tick_start_delay = total_ticks;
	}
	else {
		if (this.process_state.paused) {
			tick_at_pause = this.process_state.current_tick;
			this.process_state.paused = false;
		}
		
		//See the comment immediately above.
		this.process_state.current_tick = total_ticks - this.process_state.tick_start_delay;
		ticks_since_paused = this.process_state.paused ? this.process_state.current_tick - tick_at_pause : 0;
		this.process_state.current_tick -= ticks_since_paused;
		this.process_state.tick_start_delay += ticks_since_paused;
	}

	let animation_tick_interval = this.process_state.current_tick - this.process_state.prev_tick,
	steps_inbetween = Math.floor(animation_tick_interval / this.settings.movement_precision);

	for (agent of this.agents) {
		agent.update(animation_tick_interval, this.settings.movement_precision, steps_inbetween);
	}

	this.process_state.prev_tick = this.process_state.current_tick;
};

/**
* Stop the animation, reset the animation state properties, and delete the agents.
*/
Agentmap.prototype.reset = function() {
	cancelAnimationFrame(this.process_state.animation_frame_id);
	this.process_state.running = false,
	this.process_state.paused = false,
	this.process_state.animation_frame_id = null,
	this.process_state.current_tick = null,
	this.process_state.prev_tick = null,
	this.process_state.tick_start_delay = null;

	for (agent of this.agents) {
		agent.delete();
	}
};

/** 
 * Stop the animation, stop updating the agents.
 */
Agentmap.prototype.pause = function() {
	cancelAnimationFrame(this.process_state.animation_frame_id);
	this.process_state.running = false,
	this.process_state.paused = true;
};

