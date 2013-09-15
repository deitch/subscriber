/*jslint node:true, nomen:true */
var _ = require('lodash'), async = require('async'),

actionMap = {
	create:"post",
	index:"get",
	show:"get",
	update:"put",
	"delete":"delete",
	patch:"patch"
},

msInDay = 24*60*60*1000,

/* 
 * pathRegexp from expressjs https://github.com/visionmedia/express/blob/master/lib/utils.js and modified per our needs
 * expressjs was released under MIT license as of this writing 
 * https://github.com/visionmedia/express/blob/9914a1eb3f7bbe01e3783fa70cb78e02570d7336/LICENSE 
 */
pathRegexp = function(path, keys, sensitive, strict) {
  if (path && path.toString() === '[object RegExp]') {
		return path;
	}
  if (Array.isArray(path)) {
		path = '(' + path.join('|') + ')';
	}
  path = path
    .concat(strict ? '' : '/?')
    .replace(/\/\(/g, '(?:/')
    .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
      keys.push({ name: key, optional: !! optional });
      slash = slash || '';
      return String(
        (optional ? '' : slash)
        + '(?:'
        + (optional ? slash : '')
        + (format || '') + (capture || ((format && '([^/.]+?)') || '([^/]+?)')) + ')'
        + (optional || '')
        + (star ? '(/*)?' : ''));
    })
    .replace(/([\/.])/g, '\\$1')
    .replace(/\*/g, '(.*)');
  return new RegExp('^' + path + '$', sensitive ? '' : 'i');
}, loader;



module.exports = {
	init: function (config) {
		config = config || {};
		var db = config.db, plans = {reset: function () {
			this.plan = {}; this.path = {}; this.trial = {};
		}}, base = ((config.base || '')+'/').replace(/\/+$/,'/'), expiry, timeout = (config.timeout || 60)*60*1000;
		
		return function (req,res,next) {
			var now = new Date().getTime(), utype = typeof(req.user), user = req.user && utype === "object" ? req.user.id : req.user;
			
			async.series([
				// first load the plans, if we do not have them or they are expired
				function (cb) {
					if (!plans || !expiry || expiry < now) {
						db.plans(function (err,p) {
							var resources = [];
							expiry = now + timeout;
							plans.reset();
							// save the plans by key
							_.each(p.plans||p,function (plan) {
								var limits;
								plans.plan[plan.name] = plan;
								if (!plan.limits) {
									limits = _.extend({},plan);
									delete limits.name;
								}
								_.each(plan.limits,function (actions,resource) {
									var acts = typeof(actions) === "number" ? ["create"] : _.keys(actions);
									_.each(acts,function (a) {
										resources.push({verb:a,resource:resource});
									});
								});
							});
							// was there a trial setting?
							if (p.trial) {
								plans.trial = p.trial.duration ? p.trial : {duration: p.trial};
							}
							
							// save the paths for each item
							_.each(_.unique(resources,function (item) {
								return(item.verb+" "+item.resource);
							}),function (entry) {
								var re, verb = entry.verb, resource = entry.resource, resourcePath = (config.paths && config.paths[resource]) ? config.paths[resource] : resource;
								if (resourcePath.charAt(0) !== '/') {
									resourcePath = (base||'/')+resourcePath;
								}
								// and now need to convert that to the regexp
								re = pathRegexp( verb === "create" || verb === "index" ? resourcePath : resourcePath+'/:id',[]);
								verb = actionMap[verb] || verb;
								plans.path[verb] = plans.path[verb] || [];
								plans.path[verb].push({re:re,name:resource});
							});
							cb();
						});
					} else {
						cb();
					}
				},function (cb) {
					var resource;
					// before we even get the user, is this a request we care about? match req.method and req.url to the list
					// 1) What are we doing? Is it something restricted by the plan?
					_.each(plans.path[req.method.toLowerCase()],function (path) {
						var ret = true;
						if (req.url.match(path.re)) {
							// this is the one we use
							resource = path.name;
							ret = false;
						}
						return (ret);
					});
					// if we matched a path, and thus have a resource, check this user plan
					if (resource) {
						if (user) {
							db.user(user,function (err,u) {
								var limit, usage, plan, name, now = new Date().getTime(), expire;
								if (err) {
									res.send(400,err);
								} else {
									if (u) {
										if (u.plan) {
											plan = u.plan.name ? u.plan : {name:u.plan};
											name = plan.name;
										}
										if (plan.expire) {
											expire = plan.expire;
										} else if (plan.trial) {
											expire = plan.join+plans.trial.duration*msInDay;
										}
										
										// is there a fallback plan?
										if (expire<now && plan.trial && plans.trial && plans.trial.fallback) {
											name = plans.trial.fallback;
										}
								
										if (plans.plan[name] && plans.plan[name].limits && plans.plan[name].limits[resource] !== undefined) {
											limit = plans.plan[name].limits[resource];
										}
										if (limit !== undefined && typeof(limit) === "object") {
											limit = limit[req.method.toLowerCase()];
										}

										// did the user have usage?
										if (u && u.usage && u.usage[resource]) {
											usage = u.usage[resource];
										} else if (u && u[resource]) {
											usage = u[resource];
										}
								
										// so now, were there limits? and did the user exceed them?
										if (limit === undefined || limit === null) {
											cb();
										} else if (usage !== undefined && usage !== null && usage >= limit){
											res.send(403,{reason:"subscription",plan:name,limit:resource,maximum:limit});
										} else if (expire<now) {
											// is the user on a trial plan, and it is expired?
											res.send(403,{reason:"subscription",plan:name,expired:true,date:expire});
										} else {
											cb();
										}
									} else {
										res.send(401);
									}
								}
							});
						} else {
							res.send(401);
						}
					} else {
						cb();
					}
				}
			],next);

		};
	}
};