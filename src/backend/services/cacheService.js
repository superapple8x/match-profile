const NodeCache = require('node-cache');
const logger = require('../config/logger');

// stdTTL: Time-to-live in seconds for standard entries. 0 = infinite.
// checkperiod: Interval in seconds to check for expired keys. 0 = no check.
// useClones: Keep false for performance unless you need to modify cached objects without affecting the original.
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

logger.info('In-memory cache service initialized.', { stdTTL: 600, checkperiod: 120 });

// Optional: Event listeners for debugging/monitoring cache events
cache.on('set', (key, value) => {
  logger.debug(`Cache SET: Key "${key}"`, { ttl: cache.getTtl(key) });
});

cache.on('del', (key, value) => {
  logger.debug(`Cache DEL: Key "${key}"`);
});

cache.on('expired', (key, value) => {
  logger.debug(`Cache EXPIRED: Key "${key}"`);
});

cache.on('flush', () => {
  logger.info('Cache FLUSHED.');
});

// Export the cache instance directly or wrap it in functions if more complex logic is needed later
module.exports = cache;

/* Example wrapper functions (if needed later):
module.exports = {
  get: (key) => {
    const value = cache.get(key);
    if (value) {
      logger.debug(`Cache HIT: Key "${key}"`);
    } else {
      logger.debug(`Cache MISS: Key "${key}"`);
    }
    return value;
  },
  set: (key, value, ttl) => { // ttl is optional, uses stdTTL if not provided
    const success = cache.set(key, value, ttl);
    if (success) {
      // logger.debug(`Cache SET: Key "${key}"`, { ttl: cache.getTtl(key) }); // Handled by event listener now
    } else {
      logger.error(`Cache SET FAILED: Key "${key}"`);
    }
    return success;
  },
  del: (key) => {
    const numDeleted = cache.del(key);
    // logger.debug(`Cache DEL: Key "${key}", Count: ${numDeleted}`); // Handled by event listener now
    return numDeleted;
  },
  flush: () => {
    cache.flushAll();
    // logger.info('Cache FLUSHED.'); // Handled by event listener now
  },
  // Add other methods like take, mget, mset etc. as needed
};
*/