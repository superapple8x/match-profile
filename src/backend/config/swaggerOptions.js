const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0', // Specify the OpenAPI version
    info: {
      title: 'Profile Matching Backend API',
      version: '1.0.0',
      description:
        'API documentation for the backend services of the Profile Matching application, including file operations, matching, LLM analysis, user authentication, and session management.',
      contact: {
        name: 'Developer',
        // url: 'http://your-project-website.com', // Optional
        // email: 'dev@example.com', // Optional
      },
    },
    servers: [
      {
        url: '/api', // Base path for all API routes served by Express
        description: 'Development server',
      },
      // Add other servers like production if needed
      // {
      //   url: 'https://production.example.com/api',
      //   description: 'Production server'
      // }
    ],
    // Define security schemes (e.g., for JWT Bearer token)
    components: {
      securitySchemes: {
        bearerAuth: { // Can be named anything, referenced in route definitions
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT', // Optional, specifies format
          description: 'Enter JWT Bearer token **_only_**',
        },
      },
    },
    // Define a global security requirement (optional, can be overridden per route)
    // security: [
    //   {
    //     bearerAuth: [], // Requires bearerAuth for all routes unless specified otherwise
    //   },
    // ],
  },
  // Path to the API docs files that contain OpenAPI annotations
  apis: ['./src/backend/routes/*.js', './src/backend/routes/*.docs.js'], // Scan route files and dedicated doc files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;