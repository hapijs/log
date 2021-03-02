'use strict';

const Os = require('os');
const Hoek = require('@hapi/hoek');
const Validate = require('@hapi/validate');
const Stdlogger = require('./stdlogger');

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
const supportedEvents = ['log', 'onRequest', 'request', 'response', 'start', 'stop'];

const internals = {
    defaultFields: {
        host: Os.hostname(),
        pid: process.pid,
        node: process.version
    },
    schema: Validate.object({
        additionalFields: Validate.object().default({}),
        defaultLevel: Validate.string().default('info').valid(...Array.from(validLogLevels.keys())),
        events: Validate.array().items(Validate.string().valid(...supportedEvents)).default(supportedEvents),
        ignoreChannels: Validate.array().items(Validate.string()),
        ignorePaths: Validate.array().items(Validate.string()),
        ignoreTags: Validate.array().items(Validate.string()),
        level: Validate.string().default('info').valid(...Array.from(validLogLevels.keys())),
        logger: Validate.object().optional(),
        logLevelMap: Validate.object().default({}),
        onError: Validate.function().optional()
    })
};

const register = function (server, options = {}) {

    const vals = Validate.attempt(options, internals.schema, 'Invalid log configuration');
    if (vals.logger === undefined) {
        vals.logger = new Stdlogger(process.stdout, process.stderr);
    }

    const additionalFields = Hoek.merge(vals.additionalFields, internals.defaultFields);
    const {
        defaultLevel,
        events,
        ignoreChannels,
        ignorePaths,
        ignoreTags,
        level,
        logger,
        logLevelMap,
        onError
    } = vals;

    const levelMap = internals.setupLogLevelMap(logLevelMap);
    const ignoreRequest = internals.createShouldIgnoreRequest(ignorePaths, ignoreTags);
    const ignoreEvent = internals.createShouldIgnoreEvent(ignoreChannels, ignoreTags);
    const defaultLogLevel = validLogLevels.get(defaultLevel);
    const maxLogLevel = validLogLevels.get(level);

    if (typeof onError === 'function') {
        logger.on('error', onError);
    }

    if (typeof logger.connect === 'function') {
        server.ext('onPreStart', async () => {

            await logger.connect();
        });
    }

    server.events.on('stop', () => {

        if (events.includes('stop')) {
            logger[defaultLevel]('server stopped', undefined, additionalFields);
        }

        if (typeof logger.close === 'function') {
            logger.close();
        }
    });

    if (events.includes('start')) {
        server.events.on('start', () => {

            logger[defaultLevel](`server started at ${server.info.uri}`, undefined, additionalFields);
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

            logger[defaultLevel](`${request.method.toUpperCase()} ${request.path} request(${request.info.id}) received`, { requestId: request.info.id }, additionalFields);
            return h.continue;
        });
    }

    const logEvent = function (desc, event, useValue) {

        // "Lowest" is the highest severity.
        let lowestLevel = Infinity;
        let level = null;   // eslint-disable-line no-shadow

        if (typeof useValue === 'string') {
            level = useValue;
            lowestLevel = validLogLevels.get(level);
        }
        else {
            for (let i = 0; i < event.tags.length; ++i) {
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
    };
};


internals.createShouldIgnoreRequest = function (paths, tags) {

    const ignorePaths = new Set(paths);
    const ignoreTags = new Set(tags);

    if (ignorePaths.size === 0 && ignoreTags.size === 0) {
        // If no paths or tags are ignored, use a simplified function.
        return internals.doNotIgnoreFunction;
    }

    return function shouldIgnoreRequest(request) {

        if (ignorePaths.size > 0 && ignorePaths.has(request.url.pathname)) {
            return true;
        }

        const routeTags = request.route.settings.tags;

        if (ignoreTags.size > 0 && routeTags) {
            for (let i = 0; i < routeTags.length; ++i) {
                if (ignoreTags.has(routeTags[i])) {
                    return true;
                }
            }
        }

        return false;
    };
};


internals.createShouldIgnoreEvent = function (channels, tags) {

    const ignoreChannels = new Set(channels);
    const ignoreTags = new Set(tags);

    if (ignoreChannels.size === 0 && ignoreTags.size === 0) {
        // If no channels or tags are ignored, use a simplified function.
        return internals.doNotIgnoreFunction;
    }

    return function shouldIgnoreEvent(event) {

        if (ignoreChannels.has(event.channel)) {
            return true;
        }

        if (ignoreTags.size > 0) {
            for (let i = 0; i < event.tags.length; ++i) {
                if (ignoreTags.has(event.tags[i])) {
                    return true;
                }
            }
        }

        return false;
    };
};


internals.doNotIgnoreFunction = function () {

    return false;
};


internals.setupLogLevelMap = function (logLevelMap) {

    const mergedMap = { ...defaultLogLevelMap, ...logLevelMap };
    const map = new Map();
    const keys = Object.keys(mergedMap);

    for (let i = 0; i < keys.length; ++i) {
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
};


module.exports = {
    register,
    requirements: {
        hapi: '>=18.0.0'
    },
    pkg: require('../package.json')
};
