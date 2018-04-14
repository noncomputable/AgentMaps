var bounding_box = [[40.6469, -73.5255], [40.6390, -73.5183]];
var sample_map = L.map("sample_map").fitBounds(bounding_box).setZoom(16);
L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
		maxZoom: 18,
	}
).addTo(sample_map);

var sample_agentmap = new Agentmap(sample_map);
sample_agentmap.mapify(bounding_box, sample_data);
