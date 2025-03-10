 /*
  * /lib/routes.js
  *
  */
 
 'use strict';
 
 var express = require('express');
 var bodyParser = require('body-parser');

 
 module.exports = function (config, app) {
 
 var isLoggedIn = function isLoggedIn(req, res, next) {
         // if user is authenticated in the session, carry on 
         if (req.isAuthenticated())
             return next();
         // if they aren't redirect them to the home page
         //res.render('login');
         res.redirect('/?redir='+encodeURIComponent(req.baseUrl));
     };
 
 var isLoggedInJson = function isLoggedInJson (req, res, next) {
     // if user is authenticated in the session, carry on 
     if (req.isAuthenticated())
         return next();
     // if they aren't return 401 http error
    //    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    //    return res.sendStatus(401);
    next();
     };
 
 function loadJson(url,cb){
     require("request")({
         url: url,
         json: true
         },
         cb);
 }

     var router = express.Router();
 
   // Automatically parse request body as JSON
   router.use(bodyParser.json());
 
  /**
    * GET /api/:modelModule/
    *
    * Retrieve a page of objects (up to 'X' at a time).
    */
   router.get('/', function (req, res, next) {
       list(req.query, 0, req.query.pageToken, function (err, entities, cursor) {
       if (err) { return next(err); }
       res.json({
         items: entities,
         nextPageToken: cursor
       });
     });
   });

 var instProcessos = crudEasy.newModel(config.mongodb.url, 'processos');
  app.use('/processos', isLoggedIn, loadCategorias, crudEasy.crudRoute(instProcessos,configProcessos));
   app.use('/api/processos', isLoggedInJson, crudEasy.apiRoute(instProcessos,configProcessos));

 router.get('/:item', function get(req, res, next) {
     model.read(req.params.item, function (err, entity) {
       if (err) { return next(err); }
       res.json(entity);
     });
   });

router.get(options.routeFilter+'/:field', function listFilter(req, res, next) {
       if (!req.params.field) {res.json({error:'Please append a field name to the request address.'})};
       model.listFilter(req.params.field, pageLimit, req.query.pageToken, function (err, entities, cursor) {
       if (err) { return next(err); }
       res.json({
         items: entities,
         nextPageToken: cursor
       });
     });
   });

   var ObjectID = require('mongodb').ObjectID;
 
   var oidRegExp = new RegExp("/^[a-fA-F0-9]{24}$/");

   var collection;
 
   // [START translate]
   function fromMongo(item) {
     if (Array.isArray(item) && item.length) {
       item = item[0];
     }
     item.id = item._id;
     delete item._id;
     return item;
   }
 
   function toMongo(item) {
     delete item.id;
     return item;
   }
   // [END translate]
 
   function getCollection(cb) {
     if (collection) {
       setImmediate(function () { cb(null, collection); });
       return;
     }
     MongoClient.connect(url, function (err, db) {
       if (err) {
         return cb(err);
       }
       collection = db.collection(collectionName);
       cb(null, collection);
     });

 // [START listFilter]
   /*function listFilter(field, limit, token, cb) {
     //token = token ? parseInt(token, 100) : 0;
     token = 0;
     if (isNaN(token)) {
       return cb(new Error('invalid token'));
     }
     getCollection(function (err, collection) {
       if (err) { return cb(err); }
       collection.distinct(field, function (err, results) {
           if (err) { return cb(err); }
           cb(null, results.map(fromMongo));
         });
     });
   }*/
   // [END listFilter]

   function list(qs, limit, token, cb) {
            token = token ? parseInt(token, 10) : 0;
                 if (isNaN(token)) {
                            return cb(new Error('invalid token'));
                                 }
                      getCollection(function (err, collection) {
                                 if (err) { return cb(err); }
                                        collection.find({})
                                   .skip(token)
                                   .limit(limit)
                                   .toArray(function (err, results) {
                                                  if (err) { return cb(err); }
                                                             var hasMore =
                                                    results.length === limit ? token + results.length : false;
                                              cb(null, results.map(fromMongo), hasMore);
                                                       }); 
                           });   
                         }     



 function read(id, cb) {
       if (!/^[a-fA-F0-9]{24}$/.test(id)) {return cb ({code: 404, message: 'Not valid ObjectId. Must be 24 hex string or 12 hex binary sequence.'})};
       getCollection(function (err, collection) {
       if (err) { return cb(err); }
       collection.findOne({
         _id: new ObjectID(id)
       }, function (err, result) {
         if (err) { return cb(err); }
         if (!result) {
           return cb({
             code: 404,
             message: 'Not found'
           });
         }
         cb(null, fromMongo(result));
       });
     });
   }

