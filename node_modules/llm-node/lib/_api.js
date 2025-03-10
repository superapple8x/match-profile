/*
 * /lib/_api.js
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

  // Automatically parse request body as JSON
  router.use(bodyParser.json());

  /**
   * GET /api/:modelModule/
   *
   * Retrieve a page of objects (up to 'X' at a time).
   */
  router.get('/', function list(req, res, next) {
    model.list(options.defaultPerPage, req.query.pageToken, function (err, entities, cursor) {
      if (err) { return next(err); }
      res.json({
        items: entities,
        nextPageToken: cursor
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
