'use strict'

var cluster = require('cluster');
var Promise = require('bluebird');
var application = require('./lib/application');
var config = require('./lib/config');
var runtime = require('./lib/runtime');
var database = require('./lib/database');
var loader = require('./lib/loader');
var generator = require('./lib/generator');
var scheduler = require('./lib/scheduler');
var utils = require('./lib/utils');
var manager = require('./lib/manager');
var watcher = require('./lib/watcher');
var diagnostics = require('./lib/diagnostics');
var server = require('./lib/server');
var tools = require('./lib/tools');
var debug = require('./lib/debug');
var broker = require('./lib/broker');
var parser = require('./lib/parser');
var queue = require('./lib/queue');
var observer = require('./lib/observer');
var engine = require('./lib/engine');
var backports = require('./lib/backports');
var _ = require('lodash');

module.exports = function(options) {
	let mikser = application(options);
	mikser.run = function() {
	 	return Promise.resolve(mikser)
			.then(debug)
			.then(broker)
			.then(config)
			.then(runtime)
			.then(database)
			.then(parser)
			.then(queue)
			.then(observer)
			.then(loader)
			.then(generator)
			.then(scheduler)
			.then(utils)
			.then(manager)
			.then(tools)
			.then(watcher)
			.then(diagnostics)
			.then(server)
			.then(engine)
			.then(backports)
			.then(() => mikser.emit('mikser.init', cluster.isMaster).return(mikser))
			.then((mikser) => { 
				if (cluster.isMaster) {
					console.log('Mikser: Loaded');
					return mikser.loadPlugins().then(() => {
						mikser.cli.init(true);					
						mikser.debug.resetWatch()
						.then(mikser.manager.glob)
						.then(mikser.manager.clean)
						.then(mikser.tools.startup)
						.then(mikser.tools.compile)
						.then(mikser.manager.sync)
						.then(mikser.server.listen)
						.then(mikser.scheduler.process)
						.then(mikser.tools.build)
						.then(mikser.watcher.start)
						.then(() => {
							if (!mikser.options.server && !mikser.options.watch) {
								mikser.exit();
							}
						});
					});
				} else {
					return mikser.loadPlugins().then(mikser.joinMaster);
				}
			}).return(mikser);
	}
	return mikser;
}