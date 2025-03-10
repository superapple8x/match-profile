'use strict';

var getConfig = module.exports = function () {
  return {
    port: process.env.PORT || 8080,

    // dataBackend can be 'datastore', 'cloudsql', or 'mongodb'. Be sure to
    // configure the appropriate settings for each storage engine below.
    // If you are unsure, use datastore as it requires no additional
    // configuration.
    dataBackend: process.env.BACKEND || 'mongodb',

    // This is the id of your project in the Google Developers Console.
    gcloud: {
      projectId: process.env.GCLOUD_PROJECT || 'your-project-id'
    },

    mysql: {
      user: process.env.MYSQL_USER || 'your-mysql-user',
      password: process.env.MYSQL_PASSWORD || 'your-mysql-password',
      host: process.env.MYSQL_HOST || 'your-mysql-host'
    },

    mongodb: {
      url: process.env.MONGO_URL || 'mongodb://<USER>:<PASSWORD>@<DOMAIN>:<PORT>/<DIRECTORY>',
      collection: process.env.MONGO_COLLECTION || 'processos'
    },
	
	
	'facebookAuth' : {
        'clientID'      : 'your-secret-clientID-here', // your App ID
        'clientSecret'  : 'your-client-secret-here', // your App Secret
        'callbackURL'   : 'http://localhost:8080/auth/facebook/callback'
    },

    'twitterAuth' : {
        'consumerKey'       : 'your-consumer-key-here',
        'consumerSecret'    : 'your-client-secret-here',
        'callbackURL'       : 'http://localhost:8080/auth/twitter/callback'
    },

    'googleAuth' : {
        'clientID'      : 'your-secret-clientID-here',
        'clientSecret'  : 'your-client-secret-here',
        'callbackURL'   : 'http://localhost:8080/auth/google/callback'
    },
	'linkedinAuth' : {
        'consumerKey'      : 'your-secret-clientID-here',
        'consumerSecret'  : 'your-client-secret-here',
        'callbackURL'   : 'http://localhost:8080/auth/linkedin/callback'
    }

  };
};

var config = getConfig();
