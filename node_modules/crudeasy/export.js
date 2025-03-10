/*
 *  export.js
 *
 *    Main entry point when using as `npm` module.
 *
 *    import as `var crudEasy = require('crudeasy');` 
 */

'use strict'
module.exports = {
    newModel:   function newModel(url, collectionName){return require('./objectMongodb')(url, collectionName);},
    crudRoute:  function crudRoute(modelInstance, optionsObject){return require('./crud')(modelInstance, optionsObject);},
    apiRoute:   function apiRoute(modelInstance, optionsObject){return require('./api')(modelInstance, optionsObject);}
}
