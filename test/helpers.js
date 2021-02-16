'use strict';

const EventEmitter = require('events');
const { expect } = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Plugin = require('../lib');

const kAnyValue = Symbol('kAnyValue');


class MockLogger extends EventEmitter {
    constructor() {

        super();
        this.items = [];
    }

    connect() {

        this.items.push('connect');
    }

    close() {

        this.items.push('close');
    }
}

[
    'emergency',
    'alert',
    'critical',
    'error',
    'warning',
    'notice',
    'info',
    'debug',
    'log'
].forEach((level) => {

    MockLogger.prototype[level] = function (...args) {

        this.items.push([level, ...args]);
    };
});

const createServer = async function (options = {}) {

    const server = new Hapi.Server();

    if (options.logger === undefined) {
        options.logger = new MockLogger();
    }

    // Attach the logger so tests have access to it.
    server.__logger = options.logger;

    const simpleHandler = function () {

        return 'success';
    };

    const handlerThatServerLogsInfo = function (request) {

        server.log(['info', 'foo'], 'server.log() from handler');
        return 'success';
    };

    const handlerThatServerLogsError = function (request) {

        server.log(['info', 'error', 'debug'], 'server.log() from handler');
        return 'success';
    };

    const handlerThatServerLogsDefaultLevel = function (request) {

        server.log(['foo'], 'server.log() from handler');
        return 'success';
    };

    const handlerThatRequestLogsInfo = function (request) {

        request.log(['info', 'foo'], 'request.log() from handler');
        return 'success';
    };

    const handlerThatRequestLogsDefaultLevel = function (request) {

        request.log(['foo'], 'request.log() from handler');
        return 'success';
    };

    const handlerThatRequestThrows = function (request) {

        throw new Error('oh no!');
    };

    const handlerWithPayload = function (request) {

        return request.payload;
    };

    await server.register({ plugin: Plugin, options });
    server.route([
        {
            method: 'GET',
            path: '/simple',
            config: {
                handler: simpleHandler
            }
        },
        {
            method: 'GET',
            path: '/route/with/tags',
            config: {
                handler: simpleHandler,
                tags: ['foo', 'bar', 'baz']
            }
        },
        {
            method: 'GET',
            path: '/handler/that/server/logs/info',
            config: {
                handler: handlerThatServerLogsInfo
            }
        },
        {
            method: 'GET',
            path: '/handler/that/server/logs/error',
            config: {
                handler: handlerThatServerLogsError
            }
        },
        {
            method: 'GET',
            path: '/handler/that/server/logs/default/level',
            config: {
                handler: handlerThatServerLogsDefaultLevel
            }
        },
        {
            method: 'GET',
            path: '/handler/that/request/logs/info',
            config: {
                handler: handlerThatRequestLogsInfo
            }
        },
        {
            method: 'GET',
            path: '/handler/that/request/logs/default/level',
            config: {
                handler: handlerThatRequestLogsDefaultLevel
            }
        },
        {
            method: 'GET',
            path: '/handler/that/request/throws',
            config: {
                handler: handlerThatRequestThrows
            }
        },
        {
            method: 'POST',
            path: '/handler/with/payload',
            config: {
                handler: handlerWithPayload
            }
        }
    ]);

    return server;
};


const validateObject = function (actual, expected) {

    const actualKeys = Object.keys(actual);

    expect(actualKeys).to.equal(Object.keys(expected));
    actualKeys.forEach((key) => {

        const value = actual[key];
        const expectedValue = expected[key];

        if (expectedValue === kAnyValue) {
            return;
        }

        expect(value).to.equal(expectedValue);
    });
};

const captureStd = function () {

    let output = '';
    let errorOutput = '';
    let combinedOutput = '';

    const onStdout = (data) => {

        output += data;
        combinedOutput += data;
    };

    const onStderr = (data) => {

        errorOutput += data;
        combinedOutput += data;
    };

    const complete = () => {

        return { output, errorOutput, combinedOutput };
    };

    return {
        complete,
        stdout: {
            write: onStdout
        },
        stderr: {
            write: onStderr
        }
    };
};


module.exports = { createServer, kAnyValue, validateObject, MockLogger, captureStd };
