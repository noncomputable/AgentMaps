var bounding_box = L.latLngBounds([40.6573, -73.5289], [40.6387, -73.5146]);
agentmap.map = L.map("sample_map").setView([40.6451, -73.5218], 15);
agentmap.layers.OSM_tiles = L.tileLayer(
	"http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
	{
		attribution: "Thanks to <a href=\"http://openstreetmap.org\">OpenStreetMap</a> community",
		maxZoom: 18,
	}
).addTo(agentmap.map);

agentmap.mapify(agentmap.map, sample_data);
