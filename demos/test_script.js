let bounding_box = [[40.6469, -73.5255], [40.6390, -73.5183]];

let map = L.map("sample_map").fitBounds(bounding_box).setZoom(16);
L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
		maxZoom: 18,
	}
).addTo(map);

let agentmap = L.A.agentmap(map);
agentmap.buildingify(bounding_box, sample_data);
agentmap.agentify(100, agentmap.seqUnitAgentMaker, {radius: .5, color: "red", fillColor: "red"});
