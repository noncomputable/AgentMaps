const path = require('path');

module.exports = {
	devtool: "eval",
	output: {
		path: path.resolve(__dirname, "site/dist"),
		filename: "agentmaps.js"
	}
}
