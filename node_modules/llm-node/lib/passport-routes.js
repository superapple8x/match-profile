// app/routes.js

module.exports = function(app, passport) {

	// ========================
	// Router content type
	app.use(function (req, res, next){
		res.set('Content-Type', 'text/html');
		next();
	});
  
    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function(req, res) {
        res.render('index'); // load the index.jade file
    });
	
    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/login', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login', { message: req.flash('loginMessage') }); 
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/perfil', // redirect to the secure profile section
        failureRedirect : '/login', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/inscrever', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('inscrever', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/inscrever', passport.authenticate('local-signup', {
        successRedirect : '/perfil', // redirect to the secure profile section
        failureRedirect : '/inscrever', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));


    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/perfil', isLoggedIn, function(req, res) {
        res.render('perfil', {
            user : req.user // get the user out of session and pass to template
        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/sair', function(req, res) {
        req.logout();
        res.redirect('/');
    });
	
	
	
	// =====================================
    // FACEBOOK ROUTES =====================
    // =====================================
    // route for facebook authentication and login
    app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

    // handle the callback after facebook has authenticated the user
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect : '/perfil',
            failureRedirect : '/'
        }));

	
	// twitter --------------------------------

	// send to twitter to do the authentication
	app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

	// handle the callback after twitter has authenticated the user
	app.get('/auth/twitter/callback',
		passport.authenticate('twitter', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));

		
	
	// linkedin --------------------------------

	// send to linkedin to do the authentication
	app.get('/auth/linkedin', passport.authenticate('linkedin', { scope :  ['r_basicprofile', 'r_emailaddress'] }));

	// handle the callback after twitter has authenticated the user
	app.get('/auth/linkedin/callback',
		passport.authenticate('linkedin', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));


	// google ---------------------------------

	// send to google to do the authentication
	app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

	// the callback after google has authenticated the user
	app.get('/auth/google/callback',
		passport.authenticate('google', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));
	
// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    // locally --------------------------------
	app.get('/connect/local', function(req, res) {
		res.render('connect-local', { message: req.flash('loginMessage') });
	});
	app.post('/connect/local', passport.authenticate('local-signup', {
		successRedirect : '/perfil', // redirect to the secure profile section
		failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

    // facebook -------------------------------

	// send to facebook to do the authentication
	app.get('/connect/facebook', passport.authorize('facebook', { scope : 'email' }));

	// handle the callback after facebook has authorized the user
	app.get('/connect/facebook/callback',
		passport.authorize('facebook', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));

    // twitter --------------------------------

	// send to twitter to do the authentication
	app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

	// handle the callback after twitter has authorized the user
	app.get('/connect/twitter/callback',
		passport.authorize('twitter', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));


    // google ---------------------------------

	// send to google to do the authentication
	app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

	// the callback after google has authorized the user
	app.get('/connect/google/callback',
		passport.authorize('google', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));
			
			
    // linkedin ---------------------------------

	// send to linkedin to do the authentication
	app.get('/connect/linkedin', passport.authorize('linkedin', { scope :  ['r_basicprofile', 'r_emailaddress']  }));

	// the callback after google has authorized the user
	app.get('/connect/linkedin/callback',
		passport.authorize('linkedin', {
			successRedirect : '/perfil',
			failureRedirect : '/'
		}));
			
			
	
	// =============================================================================
	// UNLINK ACCOUNTS =============================================================
	// =============================================================================
	// used to unlink accounts. for social accounts, just remove the token
	// for local account, remove email and password
	// user account will stay active in case they want to reconnect in the future

    // local -----------------------------------
    app.get('/unlink/local', function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function(err) {
            res.redirect('/perfil');
        });
    });

    // facebook -------------------------------
    app.get('/unlink/facebook', function(req, res) {
        var user            = req.user;
        user.facebook.token = undefined;
        user.save(function(err) {
            res.redirect('/perfil');
        });
    });

    // twitter --------------------------------
    app.get('/unlink/twitter', function(req, res) {
        var user           = req.user;
        user.twitter.token = undefined;
        user.save(function(err) {
           res.redirect('/perfil');
        });
    });

    // google ---------------------------------
    app.get('/unlink/google', function(req, res) {
        var user          = req.user;
        user.google.token = undefined;
        user.save(function(err) {
           res.redirect('/perfil');
        });
    });


    // linkedin ---------------------------------
    app.get('/unlink/linkedin', function(req, res) {
        var user          = req.user;
        user.linkedin.token = undefined;
        user.save(function(err) {
           res.redirect('/perfil');
        });
    });
};

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}
