/*
 * /crud.js
 *
 */

'use strict';

var express = require('express');
var bodyParser = require('body-parser');

module.exports = function newModel(model, options) {


    if (!options) {
	    var options = {
		    "defaultPerPage": 10
	    };
    };

    if (!options.routeFilter) {options.routeFilter = '/filter/:field'};
    if (!options.routeNew) {options.routeNew = '/new'};
    if (!options.routeDelete) {options.routeDelete = '/:item/delete'};
    if (!options.routeEdit) {options.routeEdit = '/:item/edit'};

	var router = express.Router();
	
    // Automatically parse request body as form data
	router.use(bodyParser.urlencoded({ extended: false }));

	// Set Content-Type for all responses for these routes
	router.use(function (req, res, next){
		res.set('Content-Type', 'text/html');
		next();
	});
  
	if (options.middle!=null) {
		for (var m=0;m<options.middle.length;m++){
			router.use(options.middle[m]);
		};
	};
    

  /**
   * GET /:modelModule/
   *
   *  Shows a list of objects, X per time.
   */
  router.get('/', function list(req, res, next) {
      var pageLimit = parseInt(req.query.perPage || options.defaultPerPage);
      model.list(req.query, pageLimit, req.query.pageToken, function (err, entities, cursor) {
//      model.list(req.query, pageLimit, req.query.pageToken, function (err, entities, cursor, total) {
      if (err) { return next(err); }
        res.render(options.viewList, {
        params: req.params,
        items: entities,
        perPage: pageLimit, 
        nextPageToken: cursor,
	pageToken: req.query.pageToken
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
      item: {},
      params: req.params,
      action: options.labelNew,
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
   * GET /:modelModule/:id/edit
   *
   *  Shows an object to be edited.
   */
  router.get(options.routeEdit, function editForm(req, res, next) {
    model.read(req.params.item, function (err, entity) {
      if (err) { return next(err); }
      res.render(options.viewEdit, {
          item: entity,
	params: req.params,
        action: options.labelEdit,
      });
    });
  });

  /**
   * POST /:modelModule/:id/edit
   *
   *  Updates an object.
   */
  router.post(options.routeEdit, function update(req, res, next) {
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
  router.get('/:item', function get(req, res, next) {
    model.read(req.params.item, function (err, entity) {
      if (err) { return next(err); }
      res.render(options.viewItem, {
	params: req.params,
        item: entity,
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


