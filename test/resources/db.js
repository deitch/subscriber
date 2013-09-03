/*jslint node:true, nomen:true */
var _ = require('lodash'), sjs = require('searchjs'), DATA = {
	plans: [
		{name:"free",clients:3,groups:5},
		{name:"basic",clients:5,groups:10},
		{name:"premium",clients:null,groups:50}
	],
	users: {
		free: {plan:"free",clients:2},
		basic: {plan:"basic",groups:10},
		premium: {plan:"premium",clients:20,groups:25}
	}	
}, data, that = {
	user: function (username,callback) {
		callback(null,data.users[username]);
	},
	plans: function (callback) {
		callback(null,data.plans);
	},
	getUserBy: function (plan) {
		return(_.where(data.users,{plan:plan}));
	},
	updateUser: function (username,field,change) {
		data.users[username][field] += change;
	},
	reset: function () {
		data = _.cloneDeep(DATA);
	},
	data: function () {
		return(data);
	}
};

that.reset();

module.exports = that;