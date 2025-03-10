/*
 * /lib/_api.js
 *
 */


'use strict';

var express = require('express');
var bodyParser = require('body-parser');



module.exports = function (model, options) {

    if (!options) {
	    var options = {
		    "defaultPerPage": 10
	    };
    };
    if (!options.routeFilter) {options.routeFilter = '/filter'};
    
    var router = express.Router();

  // Automatically parse request body as JSON
  router.use(bodyParser.json());

	if (options.middle!=null) {
		for (var m=0;m<options.middle.length;m++){
			router.use(options.middle[m]);
		};
	};


  /**
   * GET /api/:modelModule/
   *
   * Retrieve a page of objects (up to 'X' at a time).
   */
  router.get('/', function list(req, res, next) {
      var pageLimit = parseInt(req.query.perPage || options.defaultPerPage);
      model.list(req.query, pageLimit, req.query.pageToken, function (err, entities, cursor, total) {
      if (err) { return next(err); }
      res.json({
        items: entities,
        nextPageToken: cursor,
	perPage:	pageLimit,
	pageToken: req.query.pageToken,
	total:	total,
      });
    });
  });

  /**
   * POST /api/:modelModule/
   *
   * Create a new object.
   */
  router.post('/', function insert(req, res, next) {
    model.create(req.body, function (err, entity) {
      if (err) { return next(err); }
      res.json(entity);
    });
  });

  /**
   * GET /api/:modelModule/:id
   *
   * Retrieve an object.
   */
  router.get('/:item', function get(req, res, next) {
    model.read(req.params.item, function (err, entity) {
      if (err) { return next(err); }
      res.json(entity);
    });
  });

  /**
   * PUT /api/:modelModule/:id
   *
   * Updates an object.
   */
  router.put('/:item', function update(req, res, next) {
    model.update(req.params.item, req.body, function (err, entity) {
      if (err) { return next(err); }
      res.json(entity);
    });
  });

  /**
   * DELETE /api/:modelModule/:id
   *
   * Deletes an object.
   */
  router.delete('/:item', function _delete(req, res, next) {
    model.delete(req.params.item, function (err) {
      if (err) { return next(err); }
      res.status(200).send('OK');
    });
  });


  /**
   * GET /api/:modelModule/:filterRoute/:field
   *
   * Retrieve a lista of options for filtering (ajax).
   */

/*  router.get(options.routeFilter+'/:field', function listFilter(req, res, next) {
      if (!req.params.field) {res.json({error:'Please append a field name to the request address.'})};
      model.listFilter(req.params.field, pageLimit, req.query.pageToken, function (err, entities, cursor) {
      if (err) { return next(err); }
      res.json({
        items: entities,
        nextPageToken: cursor
      });
    });
  });
*/
  /**
   * Errors on "/api/:modelModule/*" routes.
   */
  router.use(function handleRpcError(err, req, res, next) {
    // Format error and forward to generic error handler for logging and
    // responding to the request
    err.response = {
      message: err.message,
      internalCode: err.code
    };
    next(err);
  });

  return router;
};
