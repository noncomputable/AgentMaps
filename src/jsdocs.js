/* This file is part of AgentMaps which is released under the Simplified BSD License. */

/* Extra documentation that isn't particular to any module */

/**
 * Represents a latitude/longitude pair. Preferably an instance of L.LatLng:
 * {@link https://leafletjs.com/reference-1.3.2.html#latlng}.
 *
 * @typedef {object} LatLng
 * @property {number} lat - A decimal latitude.
 * @property {number} lng - A decimal longitude.
 * @property {Place} [new_place] - A place (unit or street) associated with this LatLng.
 */

/**
 * A GeoJSON feature object.
 *
 * @typedef {object} Feature
 * @property {string} type - Should be "Feature".
 * @property {object} properties - Non-geometric properties of the feature.
 * @property {object} geometry - Geometric properties of the feature (a GeoJSON spec of the feature's geometry).
 * @property {string} geometry.type - The feature's GeoJSON geometry type.
 * @property {Array} geometry.coordinates - The coordinates specifying the feature's geometry.
 * @see {@link http://geojson.org/}
 */

/**
 * A GeoJSON {@link Feature} specifically for individual points.
 *
 * @typedef {Feature} Point
 * @property {Array} geometry.coordinates - A single array with 2 elements: [longitude, latitude].
 */

/**
 * A object describing a location.
 *
 * @typedef {object} Place
 * @property {string} type - Either "street", "unit", or "unanchored".
 * @property {number} id - The ID of either a street or unit in the appropriate layer group, if the place is "street" or "unit".
 */
