var agentmaps = {
	mapify: mapify,
	features: {
		units: []
	},
};

function mapify (map, geoJSON_data, geoJSON_data_URI) {
	//if (!GeoJSON_data && GeoJSON_data_URI) {}
	
	var geoJSON_options = {
		onEachFeature: generateHouses,
		style:	{
			"color": "black",
			"weight": 1,
			"opacity": .65
		}
	};
				
	window.geo_layer = L.geoJSON(
		geoJSON_data,
		geoJSON_options
	).addTo(map);
}
