'use strict';
const validLogLevels = new Map([
  ['emergency', 0], // System is unusable.
  ['alert', 1],     // Should be corrected immediately.
  ['critical', 2],  // Critical conditions.
  ['error', 3],     // Error conditions.
  ['warning', 4],   // May indicate that an error will occur if action is not taken.
  ['notice', 5],    // Events that are unusual, but not error conditions.
  ['info', 6],      // Normal operational messages that require no action.
  ['debug', 7]      // Information useful to developers for debugging the application.
]);
const defaultLogLevelMap = {
  emerg: 'emergency',
  emergency: 'emergency',
  alert: 'alert',
  crit: 'critical',
  critical: 'critical',
  err: 'error',
  error: 'error',
  warn: 'warning',
  warning: 'warning',
  notice: 'notice',
  info: 'info',
  log: 'info',
  debug: 'debug'
};


function register (server, options = {}) {
  if (typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }

  const {
    additionalFields = {},
    defaultLevel = 'info',
    events = ['log', 'onRequest', 'request', 'response', 'start', 'stop'],
    ignoreChannels = [],
    ignorePaths = [],
    ignoreTags = [],
    level = 'info',
    logger = null,  // TODO(cjihrig): Support creating the logger internally.
    logLevelMap = {},
    onError = undefined
  } = options;

  validateArrayOfStrings(events, 'events');
  validateArrayOfStrings(ignoreChannels, 'ignoreChannels');
  validateArrayOfStrings(ignorePaths, 'ignorePaths');
  validateArrayOfStrings(ignoreTags, 'ignoreTags');
  validateLogLevel(defaultLevel, 'defaultLevel');
  validateLogLevel(level, 'level');

  if (typeof additionalFields !== 'object' || additionalFields === null) {
    throw new TypeError('additionalFields must be an object');
  }

  if (typeof logger !== 'object' || logger === null) {
    throw new TypeError('logger must be an object');
  }

  const levelMap = setupLogLevelMap(logLevelMap);
  const ignoreRequest = createShouldIgnoreRequest(ignorePaths, ignoreTags);
  const ignoreEvent = createShouldIgnoreEvent(ignoreChannels, ignoreTags);
  const defaultLogLevel = validLogLevels.get(defaultLevel);
  const maxLogLevel = validLogLevels.get(level);

  if (typeof onError === 'function') {
    logger.on('error', onError);
  } else if (onError !== undefined) {
    throw new TypeError('onError must be a function');
  }

  server.ext('onPreStart', async (request) => {
    await logger.connect();
  });

  server.events.on('stop', () => {
    if (events.includes('stop')) {
      logger[defaultLevel]('server stopped', undefined, additionalFields);
    }

    logger.close();
  });

  if (events.includes('start')) {
    server.events.on('start', () => {
      logger[defaultLevel]('server started', undefined, additionalFields);
    });
  }

  if (events.includes('log')) {
    server.events.on('log', (event, tags) => {
      if (ignoreEvent(event)) {
        return;
      }

      logEvent('log event', event);
    });
  }

  if (events.includes('request')) {
    server.events.on('request', (request, event, tags) => {
      if (ignoreEvent(event) || ignoreRequest(request)) {
        return;
      }

      if (event.error) {
        logEvent('request error', event, 'error');
        return;
      }

      logEvent('request log event', event);
    });
  }

  if (events.includes('response')) {
    server.events.on('response', (request) => {
      if (ignoreRequest(request)) {
        return;
      }

      const { info, response } = request;

      // If response is null, it means the client cancelled the request.
      const payload = {
        req: {
          id: info.id,
          method: request.method,
          path: request.path,
          headers: request.headers,
          remoteAddress: info.remoteAddress,
          remotePort: info.remotePort,
          query: request.query,
          payload: request.payload
        },
        /* $lab:coverage:off$ */
        res: response === null ? 'request cancelled by client' : {
          statusCode: response.statusCode,
          headers: response.headers
        },
        responseTime: (info.completed !== undefined ? info.completed : info.responded) - info.received
        /* $lab:coverage:on$ */
      };

      logger[defaultLevel]('request completed', payload, additionalFields);
    });
  }

  if (events.includes('onRequest')) {
    server.ext('onRequest', (request, h) => {
      if (ignoreRequest(request)) {
        return h.continue;
      }

      logger[defaultLevel]('request received', request.info.id, additionalFields);
      return h.continue;
    });
  }

  function logEvent (desc, event, useValue) {
    // "Lowest" is the highest severity.
    let lowestLevel = Infinity;
    let level = null;

    if (typeof useValue === 'string') {
      level = useValue;
      lowestLevel = validLogLevels.get(level);
    } else {
      for (let i = 0; i < event.tags.length; i++) {
        const tag = event.tags[i];
        const mappedLevel = levelMap.get(tag);

        if (mappedLevel === undefined) {
          continue;
        }

        const numericLevel = validLogLevels.get(mappedLevel);

        if (numericLevel < lowestLevel) {
          lowestLevel = numericLevel;
          level = mappedLevel;
        }
      }

      if (level === null) {
        level = defaultLevel;
        lowestLevel = defaultLogLevel;
      }
    }

    if (lowestLevel > maxLogLevel) {
      return;
    }

    logger[level](desc, event, additionalFields);
  }
}


function createShouldIgnoreRequest (paths, tags) {
  const ignorePaths = new Set(paths);
  const ignoreTags = new Set(tags);

  if (ignorePaths.size === 0 && ignoreTags.size === 0) {
    // If no paths or tags are ignored, use a simplified function.
    return doNotIgnoreFunction;
  }

  return function shouldIgnoreRequest (request) {
    if (ignorePaths.size > 0 && ignorePaths.has(request.url.pathname)) {
      return true;
    }

    const routeTags = request.route.settings.tags;

    if (ignoreTags.size > 0 && routeTags) {
      for (let i = 0; i < routeTags.length; i++) {
        if (ignoreTags.has(routeTags[i])) {
          return true;
        }
      }
    }

    return false;
  };
}


function createShouldIgnoreEvent (channels, tags) {
  const ignoreChannels = new Set(channels);
  const ignoreTags = new Set(tags);

  if (ignoreChannels.size === 0 && ignoreTags.size === 0) {
    // If no channels or tags are ignored, use a simplified function.
    return doNotIgnoreFunction;
  }

  return function shouldIgnoreEvent (event) {
    if (ignoreChannels.has(event.channel)) {
      return true;
    }

    if (ignoreTags.size > 0) {
      for (let i = 0; i < event.tags.length; i++) {
        if (ignoreTags.has(event.tags[i])) {
          return true;
        }
      }
    }

    return false;
  };
}


function doNotIgnoreFunction () {
  return false;
}


function validateArrayOfStrings (arr, name) {
  if (!Array.isArray(arr)) {
    throw new TypeError(`${name} must be an array`);
  }

  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string') {
      throw new TypeError(`${name}[${i}] must be a string`);
    }
  }
}


function validateLogLevel (level, name) {
  if (typeof level !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }

  if (!validLogLevels.has(level)) {
    throw new Error(`${level} is not a valid log level`);
  }
}


function setupLogLevelMap (logLevelMap) {
  if (logLevelMap === null || typeof logLevelMap !== 'object') {
    throw new TypeError('logLevelMap must be an object');
  }

  const mergedMap = { ...defaultLogLevelMap, ...logLevelMap };
  const map = new Map();
  const keys = Object.keys(mergedMap);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = mergedMap[key];

    if (value === undefined || value === null) {
      // Allow users to unset predefined values.
      continue;
    }

    if (!validLogLevels.has(value)) {
      throw new Error(`${value} is not a valid log level`);
    }

    map.set(key, value);
  }

  return map;
}


module.exports = {
  register,
  requirements: {
    hapi: '>=18.0.0'
  },
  pkg: require('../package.json')
};
