'use strict'

var Promise = require('bluebird');
var moment = require('moment');
var S = require('string');

module.exports = function(mikser) {
	mikser.queue = {
		concurrency: mikser.config.workers * 2,
		processed: 0,
		pending: 0,
		remainingTime: 0,
		averageTime: 0
	};

	let debug = mikser.debug('queue');
	let started = false;
	let concurent = 0;
	let queue = [];
	let startTime = new Date().getTime();
	let maxStatus = 0;

	function dequeue() {
		debug("Concurent:", concurent, 'Left:', queue.length);
		if (!queue.length) return;
		while(concurent < mikser.queue.concurrency && queue.length) {
			concurent++;
			let action = queue.shift();
			action().finally(() => {
				mikser.queue.processed++;
				concurent--;
				mikser.queue.pending = queue.length + concurent;
				if (mikser.queue.processed > mikser.queue.concurrency * 3) {
					let currentTime = new Date().getTime();
					mikser.queue.averageTime = Math.round((currentTime - startTime) / mikser.queue.processed);
					mikser.queue.remainingTime = mikser.queue.averageTime * mikser.queue.pending; 
					debug("Elapsed time:", currentTime - startTime, "Average time:", mikser.queue.averageTime, "Remaining time:", mikser.queue.remainingTime);				
				}

				let status = 
					'Processed: ' + mikser.queue.processed;
				if (mikser.queue.pending) {
					status += ' Pending: ' + mikser.queue.pending;
				}
				if (mikser.queue.averageTime && mikser.queue.pending > mikser.queue.concurrency) {
					let duration = moment.duration(mikser.queue.remainingTime);
					status += ' Remaining time: ' + 
						S(duration.hours()).padLeft(2, '0') + ':' +
						S(duration.minutes()).padLeft(2, '0') + ':' +
						S(duration.seconds()).padLeft(2, '0');
				}

				maxStatus = Math.max(maxStatus, status.length);
				if (mikser.options.debug) {
					debug(status);
				} else if (!mikser.queue.pending) {
					console.log(S(status).padRight(maxStatus).s);
				} else {
					process.stdout.write(S(status).padRight(maxStatus) + '\x1b[0G');					
				}

				dequeue();
			});
		}
	}

	mikser.queue.start = function() {
		if (!queue.length) return Promise.resolve();
		if (started) return started;

		mikser.queue.processed = 0;
		mikser.queue.pending = queue.length;
		mikser.queue.remainingTime = 0;
		mikser.queue.averageTime = 0;

		started = new Promise((resolve, reject) => {
			startTime = new Date().getTime();
			dequeue();
			let interval = setInterval(() => {
				if (!mikser.queue.pending) {
					clearInterval(interval);
					started = false;
					let endTime = new Date().getTime();
					let duration = moment.duration(endTime - startTime);

					mikser.diagnostics.log('info','Generation time:', 
						S(duration.hours()).padLeft(2, '0') + ':' +
						S(duration.minutes()).padLeft(2, '0') + ':' +
						S(duration.seconds()).padLeft(2, '0'));
					resolve();
				}
			}, 1000);
		});
		return started;
	}

	mikser.queue.add = function(action) {
		queue.push(action);
	}

	return Promise.resolve(mikser);
}