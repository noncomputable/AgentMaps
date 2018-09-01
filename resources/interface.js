var reset_button = document.getElementById("reset"),
run_button = document.getElementById("run");

//Disable the "Run" button at first.
run.disabled = "disabled";

reset_button.onclick = function() {
	if (this.textContent == 'Start') { 
		this.textContent = 'Reset'; 
		run_button.textContent = 'Pause'; 
		run_button.disabled = ''; setup(); 
		agentmap.run(); 
	} else { 
		run_button.textContent = 'Run'; 
		agentmap.clear(); 
		setup(); 
	}
};

run_button.onclick = function() {
	if (this.textContent == 'Run') { 
		this.textContent = 'Pause'; 
		agentmap.run(); 
	} else { 
		this.textContent = 'Run'; 
		agentmap.pause(); 
	}
}

var ticks_display = document.getElementById("tick_value");

//Map slider values to animation_gap values.
var animation_interval_map = {
	1: 0,
	2: 1000,
	3: 100,
	4: 10,
	5: 1
};
