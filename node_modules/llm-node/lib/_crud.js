/*
 * /lib/_crud.js
 *
 */


'use strict';

var express = require('express');
var bodyParser = require('body-parser');

if (!options) {
	var options = {
		"defaultPerPage": 10;
	};

module.exports = function (model, options) {

	var router = express.Router();

	// Automatically parse request body as form data
	router.use(bodyParser.urlencoded({ extended: false }));

	// Set Content-Type for all responses for these routes
	router.use(function (req, res, next){
		res.set('Content-Type', 'text/html');
		next();
	});
  
/*	router.use(function isLoggedIn(req, res, next) {

		// if user is authenticated in the session, carry on 
		if (req.isAuthenticated())
			return next();

		// if they aren't redirect them to the home page
		//res.render('login');
		res.redirect('/?redir='+encodeURIComponent(req.baseUrl));
	});
*/
  /**
   * GET /:modelModule/
   *
   *  Shows a list of objects, X per time.
   */
  router.get('/', function list(req, res, next) {
      model.list(options.defaultPerPage, req.query.pageToken, function (err, entities, cursor) {
      if (err) { return next(err); }
        res.render(options.viewList, {
        items: entities,
        perPage: options.defaultPerPage,
        nextPageToken: cursor
      });
    });
  });

  /**
   * GET /:modelModule/:new as defined in options.routeNew
   *
   *  Shows a form to add new item.
   */

  router.get(options.routeNew, function addForm(req, res) {
    res.render(options.viewNew, {
      processo: {},
      action: options.labelNew
    });
  });

  /**
   * POST /:modelModule/:add as defined in options.routeNew
   *
   * Creates an object.
   */
  router.post(options.routeNew, function insert(req, res, next) {
    var data = req.body;

    // Save the data to the database.
    model.create(data, function (err, savedData) {
      if (err) { return next(err); }
      res.redirect(req.baseUrl + '/' + savedData.id);
    });
  });

  /**
   * GET /:modelModule/:id/editar
   *
   *  Shows an object to be edited.
   */
  router.get(options.routeEdit, function editForm(req, res, next) {
    model.read(req.params.item, function (err, entity) {
      if (err) { return next(err); }
      res.render(options.viewEdit, {
        item: entity,
        action: options.labelEdit
      });
    });
  });

  /**
   * POST /:modelModule/:id/editar
   *
   *  Updates an object.
   */
  router.post('/:item/editar', function update(req, res, next) {
    var data = req.body;

    model.update(req.params.item, data, function (err, savedData) {
      if (err) { return next(err); }
      res.redirect(req.baseUrl + '/' + savedData.id);
    });
  });

  /**
   * GET /:modelModule/:id
   *
   *  Shows an object.
   */
  router.get('/:processo', function get(req, res, next) {
    model.read(req.params.processo, function (err, entity) {
      if (err) { return next(err); }
****      res.render(options.viewObject, {
        processo: entity
      });
    });
  });

  /**
   * GET /:modelModule/:id/:Delete
   *
   *  Delestes an object.
   */
  router.get(options.routeDelete, function _delete(req, res, next) {
    model.delete(req.params.item, function (err) {
      if (err) { return next(err); }
      res.redirect(req.baseUrl);
    });
  });

  /**
   * Errors on "/:modelModule/*" routes.
   */
  router.use(function handleRpcError(err, req, res, next) {
    // Format error and forward to generic error handler for logging and
    // responding to the request
    err.response = err.message;
    next(err);
  });

  return router;
};
