var bounding_box = L.latLngBounds([40.6573, -73.5289], [40.6387, -73.5146]);
var sample_map = L.map("sample_map").setView([40.6451, -73.5218], 15);

var tile_layer = L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
	attribution: "Map data © <a href=\"http://openstreetmap.org\">OpenStreetMap</a> contributors",
	maxZoom: 18,
	}
).addTo(sample_map);

var geo_layer;

agentmaps.mapify(sample_map, sample_data);
