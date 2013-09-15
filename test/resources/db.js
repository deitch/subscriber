/*jslint node:true, nomen:true */
var _ = require('lodash'), sjs = require('searchjs'), DATA = {
	plans: [
		{name:"free",limits:{clients:3,groups:5,other:2}},
		{name:"basic",limits:{clients:5,groups:10,other:5}},
		{name:"premium",clients:null,groups:50,other:20}
	],
	users: {
		free: {plan:{name:"free"},usage:{clients:2,other:2}},
		basic: {plan:"basic",usage:{groups:10,other:4}},
		premium: {plan:{name:"premium"},clients:20,groups:25,other:19},
		trial: {plan:{name:"basic",trial:true},clients:4,groups:6}
	},
	trial: {
		duration:14,fallback:"free"
	}
}, data, that = {
	regular: {
		user: function (username,callback) {
			callback(null,_.cloneDeep(data.users[username]));
		},
		plans: function (callback) {
			callback(null,_.cloneDeep({trial:data.trial,plans:data.plans}));
		}
	},
	planOnly: {
		user: function (username,callback) {
			callback(null,_.cloneDeep(data.users[username]));
		},
		plans: function (callback) {
			callback(null,_.cloneDeep({plans:data.plans}));
		}
	},
	trialShorthand: {
		user: function (username,callback) {
			callback(null,_.cloneDeep(data.users[username]));
		},
		plans: function (callback) {
			callback(null,_.cloneDeep({trial:data.trial.duration,plans:data.plans}));
		}
	},
	planOnlyShorthand: {
		user: function (username,callback) {
			callback(null,_.cloneDeep(data.users[username]));
		},
		plans: function (callback) {
			callback(null,_.cloneDeep(data.plans));
		}
	},
	getUserBy: function (plan) {
		return(_.where(data.users,{plan:plan}));
	},
	updateUsage: function (username,field,change) {
		var usage = data.users[username].usage || data.users[username];
		usage[field] = change;
	},
	updateUserPlan: function (username,field,value) {
		if (data.users[username] && data.users[username].plan && data.users[username].plan.name) {
			data.users[username].plan[field] = value;
		}
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