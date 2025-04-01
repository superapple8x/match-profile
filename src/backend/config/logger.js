const winston = require('winston');
const path = require('path');

// Ensure logs directory exists
const fs = require('fs');
const logDir = path.join(__dirname, '../logs'); // Log directory relative to config file's location
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3, // For HTTP request logging
  verbose: 4,
  debug: 5,
  silly: 6
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(logColors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info'; // More verbose in dev
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Log stack traces for errors
  winston.format.splat(), // Interpolate splat (%s, %d, %j) messages
  winston.format.json() // Log in JSON format for file transport
);

// Console transport format (different for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.align(),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Define transports (output destinations)
const transports = [
  // Always log errors to a separate file
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat // JSON format for errors
  }),
  // Log everything to a combined file
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: logFormat // JSON format for combined logs
  })
];

// Add console transport only in development for cleaner production logs
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
} else {
    // Add a basic console transport for production as well, but using JSON format
    transports.push(
        new winston.transports.Console({
            format: logFormat // Use JSON format for console in production
        })
    );
}


// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format: logFormat, // Default format (used by file transports)
  transports: transports,
  exitOnError: false // Do not exit on handled exceptions
});

// Create a stream object with a 'write' function that will be used by morgan (if added later)
logger.stream = {
  write: (message) => {
    // Use http level for morgan logs
    logger.http(message.substring(0, message.lastIndexOf('\n')));
  },
};

module.exports = logger;