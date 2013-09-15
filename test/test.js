/*jslint node:true, nomen:true, debug:true */
/*global before, beforeEach, it, describe */
var db = require('./resources/db'), express = require('express'), app, request = require('supertest'), r,
subscriber = require('../lib/subscriber'),
getUser = function (req,res,next) {
	var auth = req.headers.authorization, tmp, text;
	if (auth) {
		tmp = auth.split(/\s+/);
		text = new Buffer(tmp[1],'base64').toString().split(':');
		req.user = text[0];
	}
	next();
},
// plans - "free" and "basic" have "limits" property, "premium" uses limits shorthand
// users - "free" and "basic" have "usage" property, "premium" uses usage shorthand
// users - "free" and "premium" have "name" object property, "basic" uses plan name shorthand
init = function (config) {
	app = express();
	app.use(express.bodyParser());
	app.use(getUser);
	app.use(subscriber.init(config));
	app.use(function (req,res,next) {
		res.send(200);
	});
	r = request(app);
},
testPlans = function (d) {
	beforeEach(function(){
	  db.reset();
	});
	before(function(){
		init({db:d});
	});
	it('should allow GET through', function(done){
	  r.get('/clients/25').expect(200,done);
	});
	it('should allow unknown field through', function(done){
	  r.get('/foobar').expect(200,done);
	});
	it('should allow user below limits to add', function(done){
	  r.post('/clients').auth("free","free").type('json').send({client:"new"}).expect(200,done);
	});
	it('should restrict user who is already at the maximum', function(done){
	  r.post('/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(403,{reason:"subscription",plan:"basic",limit:"groups",maximum:10},done);
	});
	
	describe('with base', function(){
		before(function(){
			init({db:d,base:"/api"});
		});
		it('should allow GET through', function(done){
		  r.get('/api/clients/25').expect(200,done);
		});
		it('should allow unknown field through', function(done){
		  r.get('/foobar').expect(200,done);
		});
		it('should allow user below limits to add', function(done){
		  r.post('/api/clients').auth("free","free").type('json').send({client:"new"}).expect(200,done);
		});
		it('should restrict user who is already at the maximum', function(done){
		  r.post('/api/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(403,{reason:"subscription",plan:"basic",limit:"groups",maximum:10},done);
		});
		it('should let through path that would have been restricted without "base" parameter', function(done){
		  r.post('/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(200,done);
		});
	});
	describe('with paths', function(){
		before(function(){
			init({db:d,paths:{
				groups: "/abc/groups"
			}});
		});
		it('should allow GET through', function(done){
		  r.get('/clients/25').expect(200,done);
		});
		it('should allow unknown field through', function(done){
		  r.get('/foobar').expect(200,done);
		});
		it('should allow user below limits to add', function(done){
		  r.post('/clients').auth("free","free").type('json').send({client:"new"}).expect(200,done);
		});
		it('should restrict user with default path who is at maximum', function(done){
			db.updateUser("free","clients",10);
		  r.post('/clients').auth("free","free").type('json').send({client:"new"}).expect(403,done);
		});
		it('should restrict user who is already at the maximum', function(done){
		  r.post('/abc/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(403,{reason:"subscription",plan:"basic",limit:"groups",maximum:10},done);
		});
		it('should let through path that would have been restricted without any parameter', function(done){
		  r.post('/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(200,done);
		});
	});
	describe('with base and paths', function(){
		before(function(){
			init({db:d,paths:{
				groups: "/abc/groups",
				other: "other"
			},base:'/api'});
		});
		it('should allow GET through', function(done){
		  r.get('/api/clients/25').expect(200,done);
		});
		it('should allow unknown field through', function(done){
		  r.get('/foobar').expect(200,done);
		});
		it('should allow user below limits to add', function(done){
		  r.post('/api/clients').auth("free","free").type('json').send({client:"new"}).expect(200,done);
		});
		it('should restrict user with default path who is at maximum', function(done){
			db.updateUser("free","clients",10);
		  r.post('/api/clients').auth("free","free").type('json').send({client:"new"}).expect(403,done);
		});
		it('should restrict user who is already at the maximum', function(done){
		  r.post('/abc/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(403,{reason:"subscription",plan:"basic",limit:"groups",maximum:10},done);
		});
		it('should let through path that would have been restricted without any parameter', function(done){
		  r.post('/groups').auth("basic","basic").type('json').send({name:"my group"}).expect(200,done);
		});
		it('should restrict user on relative path with base', function(done){
		  r.post('/api/other').auth("free","free").type('json').send({other:"another"}).expect(403,{reason:"subscription",plan:"free",limit:"other",maximum:2},done);
		});
	});
		
};

before(function(){
  debugger;
});

describe('subscriber', function(){
	describe('plan only shorthand', function(){
		testPlans(db.planOnlyShorthand);
	});
	describe('trial shorthand', function(){
		testPlans(db.trialShorthand);
		// need to test for trials
	});
	describe('plan only', function(){
		testPlans(db.planOnly);
	});
	describe('regular', function(){
		testPlans(db.planOnly);
		// need to test for trials
	});
});
