// =====================
// # /main.js
//

'use strict';

const path         = require('path'),
      express      = require('express'),
      config       = require('./lib/config')(),
      mongoose     = require('mongoose'),
      passport     = require('passport'),
      flash        = require('connect-flash'),
      morgan       = require('morgan'),
      cookieParser = require('cookie-parser'),
      bodyParser   = require('body-parser'),
      session      = require('express-session'),
      MongoStore   = require('connect-mongo')(session);
//    MongoDBStore = require('connect-mongodb-session')(session);


console.log("\nPorta: %s\nURL: %s\n", config.port, config.mongodb.url);

// configuration ========================================
mongoose.connect(config.mongodb.url, function connectionError(error){console.error(error);});
mongoose.connection.on('error', function dbConnectionError(err, req, res, next){
  console.error(err);
  res.status(500).send(err.response || 'DB Connection Error!');
});

require('./lib/passport')(passport); // pass passport for configuration

var app = express();

// set up our express application
app.use(morgan('combined', {
      skip: function (req, res) { if (process.env.NODE_ENV=='production') { return req.connection.remoteAddress == config.hostname } }
})); // log every request to the console //dev
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({extended: false})); // get information from html forms

// app.set('view engine', 'ejs'); // set up ejs for templating

// Session on Mongodb

/*
var whereToStoreSessions = new MongoDBStore({ 
      uri: config.mongodb.url,
      collection: 'sessions'
      },
      function(error) {
	    console.error(error);
      });
 
    // Catch errors 
    whereToStoreSessions.on('error', function(error) {
//      assert.ifError(error);
//      assert.ok(false);
    console.error(error);
    });
*/
/*
    app.use(require('express-session')({
      secret: 'esteéumprogramaQUeestáUsandpeoSEcret20160503',
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week 
      },
      saveUninitialized: true,
      resave: true,
      store: whereToStoreSessions
    }));
*/

app.use(session({
    secret: 'esteéumprogramaQUeestáUsandpeoSEcret20160503',
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week 
    },
    saveUninitialized: false,
    resave: true,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

// required for passport
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


//==============================
// Resume normal app routines
app.disable('etag');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('trust proxy', true);
//app.configure('development', function () { app.locals.pretty = true; });


//=============================
//  LOAD Crudeasy Modules (Crud and Api routes)
//  See crudeasy's documentation
require('./lib/crudeasy-modules.js')(config, app);

// // ============================
// // Example loading of a crudeasy module would be as follows:
// 
// const crudEasy = require('crudeasy');
// const isLoggedIn = function isLoggedIn(req, res, next) {
//		// if user is authenticated in the session, carry on 
//		if (req.isAuthenticated())
//			return next();
//		// if they aren't redirect them to the home page
//		res.render('login');
// };
// var tableConfig = {
//    url: config.mongodb.url,
//    collection:     "table",
//    defaultPerPage: 10,
//    routeNew:       "/new",
//    routeDelete:    "/:item/delete",
//    routeEdit:      "/:item/edit",
//    labelNew:       "New",
//    labelEdit:      "Edit",
//    viewNew:        "table/form.jade", 
//    viewItem:       "table/view.jade",
//    viewList:       "table/list.jade",
//    viewEdit:       "table/form.jade",
//    middle:         [isLoggedIn]
//	};
// // mongodb url and collection name:
// var tableInstance = crudEasy.newModel(config.mongodb.url, 'table'); 
// app.use('/table', crudEasy.crudRoute(tableInstance, tableConfig));
// app.use('/api/table', crudEasy.apiRoute(tableInstance, tableConfig));
// // [END] Example

//=============================
// Static routes 
app.use(express.static('public'));


//=============================
// Login and oauth routes for passport
// load our routes and pass in our app and fully configured passport
require('./lib/passport-routes.js')(app, passport);

//require('./lib/api-routes.js')(config,app);

// Basic 404 handler
app.use(function (req, res) {
  res.status(404).send('Not Found');
});

// Basic error handler
app.use(function (err, req, res, next) {
  /* jshint unused:false */
  console.error(err);
  // If our routes specified a specific response, then send that. Otherwise,
  // send a generic message so as not to leak anything.
  res.status(500).send(err.response || 'Something broke!');
});

//if (module === require.main) {
  // Start the server
  var server = app.listen(config.port, config.hostname, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('App listening at http://%s:%s', host, port);
  });
//}

module.exports = app;
