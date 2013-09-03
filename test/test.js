/*jslint node:true, nomen:true, debug:true */
/*global before, beforeEach, it, describe */
var db = require('./resources/db'), express = require('express'), app, request = require('supertest'), r,
subscriber = require('../lib/subscriber');

before(function(){
  debugger;
});

describe('subscriber', function(){
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
	beforeEach(function(){
	  db.reset();
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
});
