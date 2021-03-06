'use strict'

var Twig = require('twig');
var twig = Twig.twig;

module.exports = function (mikser, context) {
	Twig.extendFilter('apply', () => undefined);
	if (context) {
		context.twig = function (source, options) {
			source = mikser.utils.findSource(source);
			var template = twig({
				data: fs.readFileSync(source, { encoding: 'utf8' })
			});
			let result = template.render(context);
			return result;
		}
	} else {
		mikser.generator.engines.push({
			extensions: ['twig'],
			pattern: '**/*.twig',
			render: function(context) {
				if (context.layout && context.layout.template) {
					var template = twig({
						data: context.layout.template
					});
					let result = template.render(context);
					return result;
				}
				return context.content;
			}
		});
	}
};