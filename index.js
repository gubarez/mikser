'use strict'

var cluster = require('cluster');
var Promise = require('bluebird');
var mikser = require('./lib/mikser');
var config = require('./lib/config');
var runtime = require('./lib/runtime');
var databse = require('./lib/database');
var loader = require('./lib/loader');
var generator = require('./lib/generator');
var scheduler = require('./lib/scheduler');
var manager = require('./lib/manager');
var watcher = require('./lib/watcher');
var diagnostics = require('./lib/diagnostics');
var server = require('./lib/server');
var compilator = require('./lib/compilator');
var debug = require('./lib/debug');
var broker = require('./lib/broker');
var parser = require('./lib/parser');
var _ = require('lodash');

module.exports.run = function(options) {
	mikser(options)
		.then(debug)
		.then(broker)
		.then(config)
		.then(runtime)
		.then(databse)
		.then(parser)
		.then(loader)
		.then(generator)
		.then(scheduler)
		.then(manager)
		.then(compilator)
		.then(watcher)
		.then(server)
		.then(diagnostics)
		.then((mikser) => {
			if (cluster.isMaster) {
				console.log('Mikser: Loaded');
				mikser.loadPlugins().then(() => {
					mikser.cli
						.option('-S, --no-server', 'don\'t run web server to access your generated website')
						.option('-W, --no-watch', 'don\'t watch your website for changes')
						.init(true);

					mikser.options = _.defaults({ 
						watch: mikser.cli.watch, 
						server: mikser.cli.server
					}, mikser.options);
					
					mikser.debug.resetWatch()
						.then(mikser.manager.glob)
						.then(mikser.manager.clean)
						.then(mikser.compilator.compile)
						.then(mikser.manager.copy)
						.then(() => {
							if (mikser.options.server) {
								mikser.server.listen();
							}

							mikser.scheduler.process().then(() => {
								if (mikser.options.watch) {
									mikser.watcher.watch();
								} 
								if (!mikser.options.server && !mikser.options.watch) {
									mikser.exit();
								}
							});
						});
				});
			} else {
				mikser.loadPlugins().then(mikser.joinMaster);
			}
		});
};

