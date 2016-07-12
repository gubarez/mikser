'use strict'

var archieml = require('archieml');
let _ = require('lodash');

module.exports = function (mikser, context) {
	function customizer(value) {
		if (_.isString(value)) {
			let trimmedValue = value.trim();

			let float = parseFloat(trimmedValue);
			let int = _.parseInt(trimmedValue);
			if (!_.isNaN(float) || !_.isNaN(int)) {
				if (float == int) return int;
				else return float;
			} 

			if (trimmedValue.toLowerCase() == 'false') return false;
			if (trimmedValue.toLowerCase() == 'true') return true;
			
			let date = Date.parse(trimmedValue);
			if (!_.isNaN(date)) return date;
		}
	}

	if (context) {
		context.archieml = function (content) {
			let raw = archieml.load(content);
			return _.cloneDeepWith(raw, customizer);
		}
	} else {
		mikser.parser.engines.push({
			pattern: '**/*.+(aml)', 
			parse: function(content) {
				let raw = archieml.load(content);
				return _.cloneDeepWith(raw, customizer);
			}
		});
	}
};