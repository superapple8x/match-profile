# crudEasy
[![Dependency Status](https://david-dm.org/RenatoXSR/crudEasy.svg)](https://david-dm.org/RenatoXSR/crudEasy)
[![NPM version](https://img.shields.io/npm/v/crudEasy.svg?style=flat)](https://www.npmjs.com/package/crudeasy)

Easily creates CRUD operations through browseable HTML routes and RESTful API json routes, in Node.js with ExpressJS and MongoDB.

* Requires `Node.js`, `MongoDB` and `ExpressJS`

## Installation instructions
1. Download repository or import with `npm install crudeasy` (note: npm modules are *lowercase*);
2. Rename _config-template.js_ to _config.js_ and change accordingly, to setup your MongoDB user, password, and URL;
3. Go to the directory _crudEasy_ and run _npm install_ (if not done already);
4. Require crudEasy with the options set forth below;
5. Do so for as many routes and collections as needed!

### v. 0.1.0
* First version. just basic CRUD oeprations and full views and RESTful API functions

## Documentation

### Observations

- Throughout the code, ":modelModule" is used in comments as an alias to the name given when the module was instantiated, but there is no such param in the routes.
- Options are passed through as a parameters object, and all of its contents are required, otherwise there will be missing routes and variables. However, error handling of undefined hasn't been implemented yet.


### Basic initialization

First instantiate a new model by calling `var modelInstance = new crudEasy.newModel(url, collectionName);` and then use the api and crud routes by calling ` app.use([route], crudEasy.crudRoute(modelInstance, optionsObject));`  and `app.use([/api/route],crudEasy.apiRoute(modelInstance, optionsObject));`.

### Options

```javascript
options = {
    url:            "mongodb://<username>:<password>@127.0.0.1:27017/mymongodb", // any valid full mongodb url.
    collection:     "nameOfCollectionInMongoDB", //any MongoDB valid name
    defaultPerPage: 10,   // number of items to be shown in each list view. *Must* be multiplier of 10, as per MongoDB's specification
    routeNew:       "/new",   // or 'n' or localized name, or any URL valid component
    routeDelete:    "/:item/delete", // the param here *must* be :item. Just change the word 'delete'.
    routeEdit:      "/:item/edit",   // the param here *must* be :item Just change the word 'edit'
    labelNew:       "New",           // this is just to be passed as a variable to the rendering engine
    labelEdit:      "Edit",          // this is just to be passed as a variable to the rendering engine
    viewNew:        "edit.jade",     //or any other view to be rendered with app.render(). Remember to set de rendering engine in the app().
    viewItem:       "view.jade",     //or any other view to be rendered with app.render(). Remember to set de rendering engine in the app().
    viewList:       "list.jade",     //or any other view to be rendered with app.render(). Remember to set de rendering engine in the app().
    viewEdit:       "edit.jade"     //or any other view to be rendered with app.render(). Remember to set de rendering engine in the app().
}
```

### Basic code sample (example)

```javascript
// Calls the Module 3 times, for routes and collections Movies and Actors.
var crudEasy = require ('crudEasy');

//  Movies CRUD module
var optionsMovies = {
    url:            "mongodb://<username>:<password>@127.0.0.1:27017/cinemadb",
    collection:     "movies",
    defaultPerPage: 10,
    routeNew:       "/new",
    routeDelete:    "/:item/delete",
    routeEdit:      "/:item/edit",
    labelNew:       "New",
    labelEdit:      "Edit",
    viewNew:        "views/movies/edit.jade", 
    viewItem:       "views/movies/view.jade",
    viewList:       "views/movies/list.jade",
    viewEdit:       "views/movies/edit.jade"
}

var modelMovies = new crudEasy.newModel(optionsMovies.url, optionsMovies.collection);
app.use('/movies', crudEasy.crudRoute(modelMovies, optionsMovies));
app.use('/api/movies',crudEasy.apiRoute(modelMovies, optionsMovies));


//  Actors CRUD module
var optionsActors = {
    url:            "mongodb://<username>:<password>@127.0.0.1:27017/cinemadb",
    collection:     "actors",
    defaultPerPage: 10,
    routeNew:       "/new",
    routeDelete:    "/:item/delete",
    routeEdit:      "/:item/edit",
    labelNew:       "New",
    labelEdit:      "Edit",
    viewNew:        "views/actors/edit.jade", 
    viewItem:       "views/actors/view.jade",
    viewList:       "views/actors/list.jade",
    viewEdit:       "views/actors/edit.jade"
}

var modelActors = new crudEasy.newModel(optionsActors.url, optionsActors.collection);
app.use('/actors', crudEasy.crudRoute(modelActors, optionsActors));
app.use('/api/actors',crudEasy.apiRoute(modelActors, optionsActors));

```

## Contact

Feel free to contact me through my GitHub profile.

From São Paulo, Brazil.

Happy coding!
