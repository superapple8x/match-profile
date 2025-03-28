'use strict';

var getConfig = module.exports = function () {
  const mongodbUser = process.env.MONGODB_USER || 'ADMIN';
  const mongodbPassword = process.env.MONGODB_PASSWORD || 'PASSWORD';
  const mongodbName = process.env.MONGODB_NAME || 'test';
  const mongodbHost = (process.env.MONGODB_HOST || process.env.OPENSHIFT_MONGODB_DB_HOST) || '127.0.0.1';
  const mongodbPort = (process.env.MONGODB_PORT || process.env.OPENSHIFT_MONGODB_DB_PORT) || '27017';
  const mongodbUri = process.env.MONGOLAB_URI || 'mongodb://'+mongodbUser+':'+mongodbPassword+'@'+mongodbHost+':'+mongodbPort+'/'+mongodbName;
  const serverIp = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
  const serverPort = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT;

  return {
    port: serverPort || 8080,
    hostname: serverIp,
    // dataBackend can be 'datastore', 'cloudsql', or 'mongodb'.
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
      url: process.env.MONGO_URL || mongodbUri,
      collection: process.env.MONGO_COLLECTION || 'test'
    },
	
	
	'facebookAuth' : {
        'clientID'      : process.env.FACEBOOK_ID || 'your-secret-clientID-here',
        'clientSecret'  : process.env.FACEBOOK_SECRET || 'your-client-secret-here',
        'callbackURL'   : process.env.FACEBOOK_CB || 'http://localhost:8080/auth/facebook/callback'
    },

    'twitterAuth' : {
        'consumerKey'       : process.env.TWITTER_KEY || 'your-consumer-key-here',
        'consumerSecret'    : process.env.TWITTER_SECRET || 'your-client-secret-here',
        'callbackURL'       : process.env.TWITTER_CB || 'http://localhost:8080/auth/twitter/callback'
    },

    'googleAuth' : {
        'clientID'      : process.env.GOOGLE_ID || 'your-secret-clientID-here',
        'clientSecret'  : process.env.GOOGLE_SECRET || 'your-client-secret-here',
        'callbackURL'   : process.env.GOOGLE_CB || 'http://localhost:8080/auth/google/callback'
    },
    'linkedinAuth' : {
        'consumerKey'      : process.env.LINKEDIN_KEY || 'your-secret-clientID-here',
        'consumerSecret'   : process.env.LINKEDIN_SECRET || 'your-client-secret-here',
        'callbackURL'      : process.env.LINKEDIN_CB || 'http://localhost:8080/auth/linkedin/callback'
    }

  };
};

var config = getConfig();

