/* This file is part of AgentMaps and is released under the Simplified BSD License. */

const path = require('path');
 
module.exports = {
	devtool: "eval",
	output: {
		path: path.resolve(__dirname, "site/dist"),
		filename: "agentmaps.js"
	},
	module: {
		rules: [
		    {
		      test: /\.js$/,
		      exclude: /(node_modules|bower_components)/,
		      use: {
			loader: 'babel-loader',
			options: {
			  presets: ['@babel/preset-env']
			}
		      }
		    }
		  ]
		}
}
