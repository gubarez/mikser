'use strict'
var browserify = require('browserify-middleware');
var express = require('express');
var path = require('path');
var fs = require("fs-extra-promise");

module.exports = function (mikser) {
	var debug = mikser.debug('server-borwser');
	return (app) => {
		app.get('*', (req, res, next) => {
			if (mikser.config.browser) {
				res.inject = function(content) {
					content = content.replace('</body>','<script src="/mikser/bundle.js" async></script></body>');							
					res.send(content);
				}
			}
			return next();
		});

		if (mikser.config.browser) {
			app.use('/mikser/browser', express.static(path.join(mikser.options.workingFolder, 'browser')));
			app.use('/mikser/browser', express.static(path.join(__dirname, '..', 'browser')));
			app.use('/mikser/node_modules', express.static(path.join(mikser.options.workingFolder, 'node_modules')));
			app.use('/mikser/node_modules', express.static(path.join(__dirname, '..', 'node_modules')));

			let modules = mikser.config.browser.map((pluginName) => {
				let pluginModule = {};
				let plugin = mikser.runtime.findBrowserPlugin(pluginName);
				pluginModule[plugin] = {expose: pluginName};
				debug('Browser module[' + pluginName + ']:', plugin);
				return pluginModule;
			});

			let runtimeBrowserConfig = path.join(mikser.config.runtimeFolder, 'browser', 'config.js');
			let config = 'module.exports = function(mikser) { mikser.config = ' + JSON.stringify(mikser.config) + '; return mikser;}';
			fs.outputFileSync(runtimeBrowserConfig, config);
			
			let configModule = {};
			configModule[runtimeBrowserConfig] = { expose: 'mikser-config' };
			modules.push(configModule);

			let mainModule = {};
			mainModule[path.join(__dirname, '../../browser/mikser.js')] = {run: true};
			modules.push(mainModule);
			
			if(mikser.options.debug) {
				app.use('/mikser/bundle.js', browserify(modules, browserify.settings.development));				
			} else {
				app.use('/mikser/bundle.js', browserify(modules, browserify.settings.production));				
			}
		}
	}
}