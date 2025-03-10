/*
 *  tests.js
 *
 */

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
