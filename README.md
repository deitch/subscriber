# subscriber


##Overview
Subscriber is ***the*** subscriptions manager for [nodejs](http://nodejs.org) and [expressjs](http://expressjs.com) apps!

````JavaScript
var subscriber = require('subscriber'), express = require('express'), app = express(), db = require('./myDbSetup');

app.use(subscriber.init({db:db,timeout:60}));

app.listen(3000);
````

Done! You now have a subscription management service filtering every request and deciding whether or not it fits within the requestor's plan or subscription.

## Features

* Multiple plan types
* Free-form plan names: name a plan whatever you want!
* Control reads, writes, creates, updates, deletes
* Works naturally with REST
* Works with any REST resource name
* Paid and free plans
* Free trials
* Plan expiry built-in
* Completely backend database agnostic
* Cache plans with controllable timeout


##Installation

````
npm install subscriber
````

Doesn't get easier than that!


## Planning your plans
While installation is easy, you probably want to spend a *bit* of time before using subscriber to think about how you want to offer plans and what you want to restrict. After all, subscriber is responsible for enforcing *your* plan restrictions, not deciding what they should be. For that, please see [the future](http://en.wikipedia.org/wiki/Skynet_%28Terminator%29). 

### Plan types
You will usually have one or more plan "types", each of which has a name and restrictions. Let's create an example of a consulting client management service, with three tiers:

* Tier "free" allows up to 3 clients
* Tier "regular" allows up to 10 clients
* Tier "pro" allows up to 30 clients

Each login will be affiliated with one plan, describing what it can do. So user "joe" logging in will retrieve that he is on plan "regular" and thus be allowed to maintain up to 10 clients.

You need to decide in advance (but can change at any time):

1. The names of your plans
2. The limits of your plans


### Free trials
Often, Web services offer a time-limited free trial of paid plans (since offering free trials of free plans really does not make much sense!). For example, if we are offering three paid plans - bronze, silver, gold - we may want to allow a new user to try any plan for 14 days, as long as s/he has never tried a plan before.

subscriber allows you to support time-limited free trials, as well as arbitrarily extend the length of a particular trial. You do need to decide in advance (but can change at any time):

1. Which plans get a free trial
2. The default length of a free trial

### Plan expiry
If you want, you can have subscriber enforce expiry dates for plans, by indicating on a user when the plan expires. Just say, "this plan expires on date X", and subscriber will enforce the user not being on the plan after that date.


## User States
This section lists all of the potential states that a user can be in, assuming the user has an account.

* No plan: User is not on any plan at all
* Regular plan unexpired: User is on a normal plan, which either has an expiry date in the future or no expiry date
* Regular plan expired: User is on an expired plan, i.e. a plan with an expiry date in the past
* Trial plan unexpired: User is on a free trial of a normal plan, which has an expiry date in the future
* Trial plan expired with fallback: User was on a free trial of a plan; the free trial expired, leaving the user to fall back to the defined fallback plan.
* Trial plan expired with no fallback: User was on a free trial of a plan; the free trial expired, no fallback was defined, leaving the user no plan to fall back upon. This is equivalent to "No plan", except that the system knows the user already *had* a free trial.
* Trial plan extended: User was on a free trial of a plan, which would have expired, but an administrator extended the expiry date *for this user*.


##Usage
### What does it provide?
subscriber provides control over requests based on different *subscriptions*. For example, if your Web service, say a consulting client management service, has three tiers: free, regular, pro. Free users get to have up to 3 clients, regular users up to 10 and pro up to 30. You want to ensure that each tier of users gets restricted to the amount they are allowed.

subscriber can also handle free trials. You may want to give users a free trial for 14 days (or maybe 25 days) of one or more of your paid plans, but only once.

subscriber controls each and every access to make sure it conforms with the subscriber's subscription rights.


#### What about authorization?
subscription is related to security, but it isn't about security. *Security Authorization* is concerned with whether or not user "john" has the security right to read user "sally"'s clients. *Subscription* is about whether or not user "john" can create another client, even one he normally would be permitted, because he hasn't yet paid for a plan that lets him.

It is really *really* **really** good to keep subscription and security authorization separate. If you make a mistake with subscriptions, well, you accidentally gave away a little something too much for free, or didn't let a customer do something for which he paid; he will call support to complain, I guarantee it!

If you make a mistake with security, user "john" can see the private information of user "sally" or even change her information. Chances are "john" and "sally" are leaving you and never coming back! And if it makes the press, well, so is everyone else.

### What does it look like?

````JavaScript
var express = require('express'), app = express(), subscriber = require('subscriber');

// set up my database
db = dbSetUp();
app.use(mySecurityPackage);
app.use(subscriber.init({db:db,timeout:60}));
app.use(app.router);

app.listen(3000);
````

Personally, I would always recommend your security authorization package, e.g. [cansecurity](http://github.com/deitch/cansecurity), come *before* subscriber. You are better off preventing someone from doing something they would *never* be allowed to do before bothering to check their plan.


### Getting started
````JavaScript
var subscriber = require('subscriber');
````

That shouldn't surprise anyone!

So what do I do with `subscriber` once I have `require`d it?

````JavaScript
app.use(subscriber.init(config)); // returns subscriber, so you can chain
````

And what exactly goes in that config, anyways?

* `db`: a database object. Required. See below.
* `timeout`: how long (in minutes) to keep the list of plans around before refreshing. Optional. Defaults to 60. Set to 0 for no caching in subscriber.
* `base`: string. Base path after which a particular resource comes. Optional. Defaults to '/'. See below.
* `paths`: object. Paths for each resource for a plan. See below.


### How It Works
When you first initialize subscriber, it issues a request to get all of the plans, and caches them. Thus, it knows exactly how many clients are allowed under the "bronze" plan and how many groups under the "premium" plan. It keeps this cache for as long as the `timeout` in the config. The next request that comes after the timeout is expired triggers a refresh. If the timeout is 0, it never caches (at least `subscriber` doesn't).


With each request of any type (`GET`, `PUT`, `PATCH`, `POST`, `DELETE`), subscriber will get the user information, and compare it to the plan in the cache (refreshing if past timeout). 

If the request is within the plan, `subscriber` will just call `next()`. If it is not, it will return a `403` error. The body of the error will be the plan and the item that was limited:

    {reason:"subscription",plan:"bronze",limit:"client",maximum:5} 
		
In the above example, the user attempted to create too many items of type client, with the plan "bronze", where the limit is 5.


### db Instance
The `db` instance passed to `subscriber.init()` is the key to subscriber getting information about:

* what plans are available
* what free trials are offered
* what usage the current user has
* what plan the current user is on
* whether or not the current user plan is a free trial
* when the current user's plan expires

The combination of all of the above allows subscriber to determine whether or not the user is permitted to perform the action s/he wants.

subscriber expects the `db` to have two asynchronous methods: `plans()` and `user()`

#### Plans
`db.plans(callback)` should retrieve all of the known plans with their limits, as well as trial information, and then pass them to the `callback`. The `callback` has the standard `expressjs`-style signature:

    callback(err,data)

`data` is a JS object composed of two parts:

* `trial`: Object/Integer. Optional. information about free trials available on all plans.
* `plans`: Array of plan objects. Required. Each object can have as many extraneous properties as it wants, but *must* have at least:
* * `name`: the name of the plan. String.
* * *`item`*: for each item limited, a key in the name of the item limited, and the value of an integer of the limit.

If there is no free trial offered, you can simplify the response by just returning the array of plans.

Examples: 

1. No trial, just plans

    `{plans:[{name:"free",clients:3,groups:2},{name:"bronze",clients:5,groups:10}]}`
		
2. No trial, just plans (simpler form)

    `[{name:"free",clients:3,groups:2},{name:"bronze",clients:5,groups:10}]`
		
3. Free trial and plans

    `{trial:14,plans:[{name:"free",clients:3,groups:2},{name:"bronze",clients:5,groups:10}]}`


In these examples, anyone in the "free" plan can have 3 clients and 2 groups, while anyone in the "bronze" plan can have 5 clients and 10 groups.

If this is the entire set of plans, then the only limits are on *creating* a new client or group, i.e. `POST /.../groups`. What about other actions? 

##### All Limits
In all cases, a limit value means:

* positive integer (e.g. `10`): that number and no more
* zero (`0`): none allowed, this action is blocked in this plan
* `null` or `undefined`: unlimited number allowed

##### Form of a plan
Each plan object in the returned array must have the following properties:

* `name`: String. Required. The name of the plan. This is never shown to the end-user (unless you choose to do so), but is used to relate the plan a user is on to the limits of the plan.
* `limits`: Object. Optional. The limits for each resource type.

Each key of `limits` represents an action with limits, e.g. `clients` above, and the value should be an object giving the action and limits. Here is an example:

````JavaScript
{name:"bronze",clients:{
	"index": null
	"show":10,
	"create": 3,
	"update": null
}}
````

In this example, users in the "bronze" plan can update (with `PUT`) or list all of their objects as many times as they want, but are limited to 10 "show" - normally `GET /api/clients/:client` - and 3 creations - normally `POST /api/clients`.


##### "create" Shorthand
Because the most common restriction is creating items, there is a shorthand to limit creation:

    {name:"bronze", limits:{groups:10}}
		
Can create no more than 10 groups. All other actions are unrestricted. This is equivalent to:

````JavaScript
{name:"bronze",limits:{groups:{
	create:10
}}}
````

But shorter is better, right?

##### Even shorter hand
If you have no `limits` property, then *all* properties of the plan itself - except the reserved "name" property - will be treated as limits:

````JavaScript
{name:"bronze",groups:{
	create:10
}}
````

or even

````JavaScript
{name:"bronze",groups:10}
````


##### Path to Resource
Of course, for subscriber to know that the request is creating a "clients", it needs to know how to match a path to a "clients". It knows it is a "create" because the request method is `POST`, but how does it know if `/api/clients` or `/api/clients10` or `/foo/bar/client/25/me` is the path you `POST` to to create a "clients"?

The two configuration options to subscriber - `base` and `paths` - determine this.

As usual, there is the default, and the explicit. 

1. Default: If no `paths` are given, then the path to each resource is simply `base+name`. Since `base` defaults to '/', then passing no parameters means that "clients" will be at `/clients` and `/clients/:client`.
2. Base: If you don't want to give explicit paths for each item, but they are not at the root of '/', then you can still override it with the `base` parameter. For example, an option of `{base:'/api'}` means "clients" will be at `/api/clients` and `/api/clients/:client`.
3. Paths: If you prefer, you can give explicit paths, as `{paths:{clients:'/foo/path/to/clients'}}` which will create paths at `/foo/path/to/clients` and `/foo/path/to/clients/:client`. Any resource *not* explicitly listed will fall back to the default.
4. Base+Paths: If you list both, then it will combine them. Resources without paths will be added to the `base`; resources with absolute paths will be taken as is; resources with relative paths will be added to the `base`.

Here are some examples. In all cases, the plan returned is `{name:"bronze",clients:10, groups:20}`


###### Nothing

Will look at the following paths:
````
GET /clients
GET /clients/:client
PUT /clients/:client
POST /clients
PATCH /clients/:client
DELETE /clients/:client
GET /groups
GET /groups/:group
PUT /groups/:group
POST /groups
PATCH /groups/:group
DELETE /groups/:group
````

###### Base

````JavaScript
subscriber.init({base:'/api'}); // or '/api/', since subscriber intelligently manages the trailing slash
````
Will look at the following paths:

````
GET /api/clients
GET /api/clients/:client
PUT /api/clients/:client
POST /api/clients
PATCH /api/clients/:client
DELETE /api/clients/:client
GET /api/groups
GET /api/groups/:group
PUT /api/groups/:group
POST /api/groups
PATCH /api/groups/:group
DELETE /api/groups/:group
````

######  Paths


````JavaScript
subscriber.init({paths:{
	clients: "/foo/path/to/clients"
}});
````

Note that there is no path given for groups, so it defaults:

````
GET /foo/path/to/clients
GET /foo/path/to/clients/:client
PUT /foo/path/to/clients/:client
POST /foo/path/to/clients
PATCH /foo/path/to/clients/:client
DELETE /foo/path/to/clients/:client
GET /groups
GET /groups/:group
PUT /groups/:group
POST /groups
PATCH /groups/:group
DELETE /groups/:group
````

###### Base+Paths

````JavaScript
subscriber.init({base:'/api',paths:{
	clients: "/my/clients",
	groups: "some/groups"
}});
````

Note that "groups" have a relative path, so `base` is prepended, while `clients` have an absolute path.

````
GET /my/clients
GET /my/clients/:client
PUT /my/clients/:client
POST /my/clients
PATCH /my/clients/:client
DELETE /my/clients/:client
GET /api/some/groups
GET /api/some/groups/:group
PUT /api/some/groups/:group
POST /api/some/groups
PATCH /api/some/groups/:group
DELETE /api/some/groups/:group
````


##### Free trial
If a free trial option is provided in `plans`, then users can have a free trial of any plan.

The trial option is provide as part of the response to `plans()` as follows:

````JavaScript
{trial:{duration:14,fallback:"free"},plans:[{name:"free",groups:2},{name:"premium",groups:5},{name:"pro",groups:10}]}
````

The value of trial is, quite simply, the length in days of the free trial. In the above example, a user can get a free trial of the "premium" or "pro" plan for 14 days, after which they will fall back to the "free" plan. 

If you don't want the user to have any fallback - i.e. after the free trial, they get no plan at all - then eliminate the "fallback" property:

````JavaScript
{trial:{duration:14},plans:[{name:"premium",groups:5},{name:"pro",groups:10}]}
````

Which can be short-handed as:

````JavaScript
{trial:14,plans:[{name:"premium",groups:5},{name:"pro",groups:10}]}
````



#### User
The other activity for which `db` is responsible is telling `subscriber` all it needs to know about a user: how many of something it already *has*.

````JavaScript
db.user("john",function(err,res){
	// res is, e.g. {name:"john",plan:{name:"free",join:1234567,expire:1238899},usage:{clients:3,groups:2}}
}); 
````

subscriber will `get` "john", and receive back what usage "john" actually has right now. In our example above, he already has 3 clients and 2 groups.

The "user" object has the following properties:


* name: String. Required. Name of the user:
* plan: Object / String. Required. Properties of the user's current plan, or just name of the plan (see plan shorthand below).
* usage: Optional. What usage the user currently has, or nothing (see usage shorthand below).

##### User plan
The "plan" property is an object with the following properties:

* name: String. Required. Name of the plan.
* trial: boolean. Optional. If `true`, then this person is in a free trial. Defaults to `false`.
* join: Integer. Required. Date of the person joining the plan, as an integer (given by `Date.getTime()`)
* expire: Integer. Optional. Date of the person's plan expiring, as an integer (given by `Date.getTime()`)

If you do not want to track when the user joined the plan, when his current plan expires, and if it is a trial, you can use the following shorthand:

````JavaScript
{name:"john",plan:"free",usage:{clients:3,groups:2}}
````

##### User usage
The "usage" property is an object. Each key is the name of a resource that is protected by subscriber; each value is the integer of the current usage of this user.

````JavaScript
{name:"john",plan:"free",usage:{clients:3,groups:2}}
````

User "john" has 3 resources of type "clients" and 2 of type "groups". 

There is also a shorthand version you can use, in which there is *no* property "usage". In that case, *every* property of the "user" object will be treated as a resource, except for reserved words "usage", "name", "plan".

````JavaScript
{name:"john",plan:"free",clients:3,groups:2}
````



##### Who is the user?
How does subscriber know which user is logged in, and thus which "name" to pass as the first argument to `db.user()`? It looks at `req.user` using the following logic:

1. If req.user is a string, use that, e.g. `req.user = "john"` will lead to `db.user("john",callback)`
2. If req.user is an object, use `req.user.id`, e.g. `req.user.id = "john" will lead to `db.user("john",callback)`
3. If req.user is `null` or `undefined`, there is no user


##### Free trial
If your system offers free trials, then the `user` object needs to have additional information about how this user signed up for the trial.

````JavaScript
{name:"john",plan:{name:"pro",join:1234567,expire:1238899,trial:true},usage:{clients:3,groups:2}}
````

When the user is no longer in a free trial, then "trial" should be set to `false` or simply deleted. 



#### Putting it Together
Let's use a real example. "john" is logged in and wants to create a new client. subscriber sees the request. If plans are already loaded and not timed out, it goes straight to checking its plans in cache, else it loads them again:

````JavaScript
db.plans(function(err,res){
	// res is:
	[
	{name:"free",clients:3},
	{name:"bronze",clients:5}
	]	
});
````

As soon as "john" makes his `POST /clients` request, subscriber retrieves all of the information about "john":

````JavaScript
db.user("john",function(err,res){
	// res is:
	{name:"john",plan:"free",clients:3,groups:2}
}); 
````

"john" is on the plan named "free", and he has 3 clients. Checking the plans, we see that the "free" plan allows a maximum of 3 clients. "john" has hit his limit, and his request to add another "client" will have a response of `403`. 


### Responses

#### Success
If the request succeeds, subscriber just calls `next()` and passes it on to your next route. subscriber becomes completely transparent.

#### Failure
If the request hits a limit, subscriber will send back a `403`, which is the appropriate error code for a request that is unauthorized.

The body of the response will detail the failure in JSON:

````JavaScript
{reason:"subscription",plan:"free",item:"clients",maximum:3}
````

It gives the reason for the failure (a subscription limit), the plan the user is on, the item that exceeded the limits, and the maximum allowed under the plan.


# Licensing
subscriber is released under the MIT License http://www.opensource.org/licenses/mit-license.php

# Author
Avi Deitcher https://github.com/deitch