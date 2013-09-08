/*jslint node:true, nomen:true */
var _ = require('lodash'), async = require('async'),

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
			this.plan = {}; this.path = [];
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
							_.each(p,function (plan) {
								plans.plan[plan.name] = plan;
								resources.push.apply(resources,_.without(_.keys(plan),"name"));
							});
							// save the paths for each item
							_.each(_.unique(resources),function (resource) {
								var resourcePath = (config.paths && config.paths[resource]) ? config.paths[resource] : resource, itemPath, resourceRe, itemRe;
								if (resourcePath.charAt(0) !== '/') {
									resourcePath = (base||'/')+resourcePath;
								}
								itemPath = resourcePath+'/:id';
								// and now need to convert that to the regexp
								resourceRe = pathRegexp(resourcePath,[]);
								itemRe = pathRegexp(itemPath,[]);
								plans.path.push({resourceRe:resourceRe,itemRe:itemRe,name:resource});
								// and save it
							});
							cb();
						});
					} else {
						cb();
					}
				},function (cb) {
					var resource, root, limit;
					// before we even get the user, is this a request we care about? match req.method and req.url to the list
					// 1) What are we doing? Is it something restricted by the plan?
					_.each(plans.path,function (path) {
						var ret = true;
						if (req.url.match(path.resourceRe)) {
							// this is the one we use
							resource = path.name;
							root = true;
							ret = false;
						} else if (req.url.match(path.itemRe)) {
							resource = path.name;
							root = false;
							ret = false;
						}
						return (ret);
					});
					// if we matched a path, and thus have a resource, check this user plan
					if (resource) {
						db.user(user,function (err,u) {
							if (err) {
								res.send(400,err);
							} else {
								if (u && u.plan && plans.plan[u.plan] && plans.plan[u.plan][resource] !== undefined) {
									limit = plans.plan[u.plan][resource];
								}
								if (limit !== undefined && typeof(limit) === "object") {
									limit = limit[req.method.toLowerCase()];
								}
								
								// so now, were there limits?
								if (limit === undefined || limit === null) {
									cb();
								} else if (u[resource] !== undefined && u[resource] !== null && u[resource] >= limit){
									res.send(403,{reason:"subscription",plan:u.plan,limit:resource,maximum:limit});
								} else {
									cb();
								}
							}
						});
					} else {
						cb();
					}
				}
			],next);

		};
	}
};