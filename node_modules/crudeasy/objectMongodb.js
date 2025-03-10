/*
 * /lib/_objectMongodb.js
 *
 */

'use strict';

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

var oidRegExp = new RegExp("/^[a-fA-F0-9]{24}$/");

module.exports = function newModel(url, collectionName) {

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
  }

  // [START list]
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
          //cb(null, results.map(fromMongo), hasMore, results.length);
        });
    });
  }
  // [END list]


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

  // [START create]
  function create(data, cb) {
    getCollection(function (err, collection) {
      if (err) { return cb(err); }
      collection.insert(data, {w: 1}, function (err, result) {
        if (err) { return cb(err); }
        var item = fromMongo(result.ops);
        cb(null, item);
      });
    });
  }
  // [END create]

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

  // [START update]
  function update(id, data, cb) {
    getCollection(function (err, collection) {
      if (err) { return cb(err); }
      collection.update(
        { _id: new ObjectID(id) },
        { '$set': toMongo(data) },
        { w: 1 },
        function (err) {
          if (err) { return cb(err); }
          return read(id, cb);
        }
      );
    });
  }
  // [END update]

  function _delete(id, cb) {
    getCollection(function (err, collection) {
      if (err) { return cb(err); }
      collection.remove({
        _id: new ObjectID(id)
      }, cb);
    });
  } 

  return {
    create: create,
    read: read,
    update: update,
    delete: _delete,
    list: list
  };
};
