function agentify (map, geoJSON_data, bounding_box, geoJSON_data_URI) 
{
	//if (!GeoJSON_data && GeoJSON_data_URI) {}
	var bounding_box = L.latLngBounds(bounding_box[0], bounding_box[1]);
	var geo_layer = L.geoJSON(
		geoJSON_data,
		{
			style: 
				{
				"color": "black",
				"weight": 1,
				"opacity": .65
				},
	}).addTo(map);
}
