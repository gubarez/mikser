'use strict'

var WebSocketServer = require('ws').Server;
var S = require('string');
var path = require('path');
var Promise = require('bluebird');

module.exports = function (mikser) {
	if (mikser.config.livereload == undefined) mikser.config.livereload = true;
	mikser.config.browser.push('livereload');

	let debug = mikser.debug('livereload');
	let livereload = {
		clients: {}
	}
	let lastClientId = 0;

	livereload.isLive = function(documentId) {
		if (mikser.server.isListening) {
			let documentUrl = mikser.state.urlmap[documentId];
			for(let clientId in livereload.clients) {
				if (documentUrl == livereload.clients[clientId].url) return true;
			}
		}
		return false;
	}


	livereload.refresh = function (documentId) {
		if (mikser.server.isListening) {
			for(let clientId in livereload.clients) {
				let client = livereload.clients[clientId];
				let documentUrl = client.url;
				if (documentId) documentUrl = mikser.state.urlmap[documentId];
				debug('Client:', client.url, documentUrl);
				if (client.url == documentUrl) {
					debug('Refreshing[' + clientId + ']', documentUrl);
					client.socket.send(JSON.stringify({
						command: 'reload',
						path: documentUrl
					}), (err) => {
						if (err) {
							if (livereload.clients[clientId]) {
								debug('Live reload disconnected:', livereload.clients[clientId].url, err);
								delete livereload.clients[clientId];
							}
						}
					});
				}
			}
		}
		return Promise.resolve();
	}

	livereload.reload = function (file) {
		file = S(file).replaceAll('\\','/').ensureLeft('/').s;
		if (mikser.server.isListening) {
			for(let clientId in livereload.clients) {
				let client = livereload.clients[clientId];
				if (!S(file).endsWith('.html')) {
					debug('Reloading[' + clientId + ']', file);
					client.socket.send(JSON.stringify({
						command: 'reload',
						path: file,
						liveCSS: true,
						liveImg: true
					}), (err) => {
						if (err) {
							if (livereload.clients[clientId]) {
								debug('Live reload disconnected:', livereload.clients[clientId].url, err);
								delete livereload.clients[clientId];
							}
						}
					});
				}
			}
		}
		return Promise.resolve();
	}

	mikser.cleanup.push(() => {
		if (mikser.server.isListening) {
			for(let clientId in livereload.clients) {
				let client = livereload.clients[clientId];
				client.socket.destroy();
			}
		}
		return Promise.resolve();
	});

	mikser.on('mikser.server.ready', () => {
		if (mikser.config.livereload) {
			let liveReloadServer = new WebSocketServer({ server: mikser.server.httpServer });
			liveReloadServer.on('connection', (socket) => {
				let clientId = lastClientId++;
				livereload.clients[clientId] = {
					socket: socket
				};

				socket.on('close', (socket) => {
					if (livereload.clients[clientId]) {
						debug('Live reload disconnected:', livereload.clients[clientId].url);
						delete livereload.clients[clientId];								
					}
				});

				socket.on('message', (message) => {
					message = JSON.parse(message);
					if (message.command === 'hello') {
						socket.send(JSON.stringify({
							command: 'hello',
							protocols: ['http://livereload.com/protocols/official-7'],
							serverName: path.basename(mikser.options.workingFolder)
						}));
					}
					else if (message.command === 'info') {
						let url = message.url.split('#')[0].split('?')[0];
						if (S(url).endsWith('/')) {
							url = url + 'index.html';
						}
						url = '/' + decodeURI(url).split('/').slice(3).join('/');
						livereload.clients[clientId].url = url;
						debug('Live reload connected:', url);
					}
				});
			});
		} else {
			console.log('Live reload: disabled');
		}
	});

	mikser.on('mikser.watcher.outputAction', (event, file) => {
		return livereload.reload(file);
	});

	mikser.on('mikser.scheduler.renderedDocument', (documentId) => {
		return livereload.refresh(documentId);
	});

	return Promise.resolve(livereload);
};