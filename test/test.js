/*jslint node:true, nomen:true, debug:true */
/*global before, beforeEach, it, describe */
var db = require('./resources/db'), express = require('express'), app, request = require('supertest'), r,
subscriber = require('../lib/subscriber');

before(function(){
  debugger;
});

describe('subscriber', function(){
	beforeEach(function(){
	  db.reset();
	});
	before(function(){
		app = express();
		app.use(express.bodyParser());
		// just to save the username as req.user
		app.use(function (req,res,next) {
			var auth = req.headers.authorization, tmp, text;
			if (auth) {
				tmp = auth.split(/\s+/);
				text = new Buffer(tmp[1],'base64').toString().split(':');
				req.user = text[0];
			}
			next();
		});
		app.use(subscriber.init({db:db}));
		app.use(function (req,res,next) {
			res.send(200);
		});
		r = request(app);
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
			app = express();
			app.use(express.bodyParser());
			// just to save the username as req.user
			app.use(function (req,res,next) {
				var auth = req.headers.authorization, tmp, text;
				if (auth) {
					tmp = auth.split(/\s+/);
					text = new Buffer(tmp[1],'base64').toString().split(':');
					req.user = text[0];
				}
				next();
			});
			app.use(subscriber.init({db:db,base:"/api"}));
			app.use(function (req,res,next) {
				res.send(200);
			});
			r = request(app);
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
			app = express();
			app.use(express.bodyParser());
			// just to save the username as req.user
			app.use(function (req,res,next) {
				var auth = req.headers.authorization, tmp, text;
				if (auth) {
					tmp = auth.split(/\s+/);
					text = new Buffer(tmp[1],'base64').toString().split(':');
					req.user = text[0];
				}
				next();
			});
			// groups has path, clients has default
			app.use(subscriber.init({db:db,paths:{
				groups: "/abc/groups"
			}}));
			app.use(function (req,res,next) {
				res.send(200);
			});
			r = request(app);
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
			db.data().users.free.clients = 10;
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
			app = express();
			app.use(express.bodyParser());
			// just to save the username as req.user
			app.use(function (req,res,next) {
				var auth = req.headers.authorization, tmp, text;
				if (auth) {
					tmp = auth.split(/\s+/);
					text = new Buffer(tmp[1],'base64').toString().split(':');
					req.user = text[0];
				}
				next();
			});
			// groups has path, clients has default
			app.use(subscriber.init({db:db,paths:{
				groups: "/abc/groups",
				other: "other"
			},base:'/api'}));
			app.use(function (req,res,next) {
				res.send(200);
			});
			r = request(app);
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
			db.data().users.free.clients = 10;
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
});
