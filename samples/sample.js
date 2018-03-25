var bounding_box = [[40.6573, -73.5289], [40.6387, -73.5146]]
var sample_map = L.map("sample_map").setView([40.6451, -73.5218], 15);

L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
	attribution: "Map data © <a href=\"http://openstreetmap.org\">OpenStreetMap</a> contributors",
	maxZoom: 18,
	}
).addTo(sample_map);

agentify(sample_map, sample_data, bounding_box);
