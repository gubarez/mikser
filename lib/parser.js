'use strict'

var Promise = require('bluebird');
var path = require('path');
var extend = require('node.extend');
var cluster = require('cluster');
var S = require('string');
var constants = require('./constants.js');
var _ = require('lodash');
var fs = require("fs-extra-promise");
var minimatch = require("minimatch");
var Route = require('route-parser');

module.exports = function(mikser) {
	mikser.config = extend({
		routes: [],
		delimiters: ['---']
	}, mikser.config);

	let parser = {
		engines: []
	}

	parser.parseRoutes = function(source, info) {
		let fileId = source
			.replace(mikser.config.documentsFolder,'')
			.replace(mikser.config.layoutsFolder,'')
			.replace(mikser.config.viewsFolder,'');
		fileId = S(fileId).replaceAll('\\','/').ensureLeft('/').s;
		if (info.meta && !info.meta.href) {
			info.meta.href = fileId;
		}

		for(let route of mikser.config.routes) {
			route = new Route(S(route).ensureLeft('/').s);
			let routeMeta = route.match(fileId);
			if (_.keys(routeMeta).length) {
				info.meta = info.meta || {};
				info.meta = _.defaultsDeep(info.meta, routeMeta);
			}
		}
		return info;
	}

	parser.findEngine = function(file) {
		for (let engine of parser.engines) {
			if (minimatch(file, engine.pattern)) {
				return engine;
			}
		}
	}

	parser.parse = function(source, data) {
		data = data || fs.readFileSync(source, 'utf8');
		var info = {data: data, meta: false, content: data, markup: false};
		if (data === '') {
			return parser.parseRoutes(source, info);
		}

		let engine = parser.findEngine(source);
		if (engine) {
			try {
				info.meta = engine.parse(info.data);
			}
			catch(err) {
				mikser.diagnostics.log('error','Error parsing:', source, err);
			}
			info.markup = true;
			info.content = '';
		} else {
			data = data.charAt(0) === '\uFEFF' ? data.slice(1) : data;

			let delimiter = '';
			for (let item of mikser.config.delimiters) {
				if (data.slice(0, item.length) == item) {
					delimiter = item;
					break;
				}
			}

			if (delimiter) {
				let lang = data.slice(delimiter.length, data.indexOf('\n'));
				let end = data.slice(delimiter.length + lang.length).indexOf('\n' + delimiter);
				let meta = data.substr(delimiter.length + 1, end - 1);

				let engine = parser.findEngine('lang.' + lang.trim());
				if (!engine) {
					engine = parser.findEngine(mikser.options.configFile);
					if (mikser.config.frontmatter) {
						engine = parser.findEngine('lang.' + mikser.config.frontmatter);
					}
				}
				if (engine) {
					try {
						info.meta = engine.parse(meta);
					} 
					catch(err) {
						mikser.diagnostics.log('error','Error parsing:', source, err);
					}
				}
				info.content = data.slice(end + delimiter.length*2 + 2);
			} else {
				let sourceBasename = path.basename(source);
				let sourceExt = path.extname(source);
				let sourceName = sourceBasename.replace(sourceExt, '');
				let sourceDir = path.dirname(source);

				let dirContent = fs.readdirSync(sourceDir);
				dirContent = dirContent.filter((fileName) => {
					if (fileName === sourceBasename) return false;
					let fileExt = path.extname(fileName);
					return fileName.replace(fileExt, '') === sourceName;
				});

				let engine, metafile;
				for (let fileName of dirContent) {
					engine = parser.findEngine(fileName);
					if (engine && metafile) {
						engine = undefined;
						mikser.diagnostics.log('error', 'Error parsing:', source, 'Only one metafile per layout is allowed');
						break;
					}
					if (engine) metafile = path.join(sourceDir, fileName);
				}

				if (engine) {
					try {
						let meta = fs.readFileSync(metafile, 'utf8');
						info.meta = engine.parse(meta);
						if (info.meta && (typeof info.meta == 'object')) info.meta.externalMeta = metafile;
					}
					catch(err) {
						mikser.diagnostics.log('error','Error parsing:', source, err);
					}
				}

			}
		}

		return parser.parseRoutes(source, info);
	}

	mikser.parser = parser;
	return Promise.resolve(mikser);
}