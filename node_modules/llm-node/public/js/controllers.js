/*
 * /js/controllers.js
 *
 */

//var ngLLM = angular.module('ngLLM', ['ngResource','ngLLM.controllers','ngCatServices']);
//var ngLLM = angular.module('ngLLM', ['ngResource','ngLLM.controllers']);
//var ngCatServices = angular.module('ngCatServices', ['ngResource']);
/*
ngCatServices.factory('Categorias', ['$resource',
  function($resource){
    return $resource('/api/categorias', {}, {
      query: {method:'GET', isArray:true}
    });
  }]);
*/

/*
angular.module('ngLLM.controllers', ['ngResource'])
	.controller('ctrlCatAcomp', function($scope){
		var Categorias = $resource('/api/categorias');
		//var categoria = User.get({userId:123}, function() {
		//  user.abc = true;
		//  user.$save();
		//});
		Categorias.query(function (response){$scope.data = response;});
	});
*/

//	.controller('ctrlCatAcomp', ['$scope', 'ngAcomps', function($scope, ngAcomps) {
//		$scope.data = {};
//		ngAcomps.query(function(response) {
//			$scope.data.acomps = response;
//			});
//		}])
//	.controller('MyCtrl2', [function() {
//		}]);
//

//var User = $resource('/user/:userId', {userId:'@id'});
//var user = User.get({userId:123}, function() {
//  user.abc = true;
//  user.$save();
//});

//var ngCatAcompServices = angular.module('phonecatServices', ['ngResource']);

/*phonecatServices.factory('Categoria', ['$resource',
  function($resource){
    return $resource('/categorias/:categoriaId', {}, {
      query: {method:'GET', params:{categoriaId:'phones'}, isArray:true}
    });
  }]);*/


