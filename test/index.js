'use strict';

const Assert = require('assert');
const Hapi = require('@hapi/hapi');
const Lab = require('@hapi/lab');
const Plugin = require('../lib');
const {
    createServer,
    kAnyValue,
    validateObject,
    MockLogger
} = require('./helpers');

const { describe, it } = exports.lab = Lab.script();


describe('Log', () => {

    it('validates register() inputs', () => {

        const check = async function (options, err) {

            const server = new Hapi.Server();

            if (typeof options === 'object' && options.logger === undefined) {
                options.logger = new MockLogger();
            }

            await Assert.rejects(() => {

                return server.register({ plugin: Plugin, options });
            }, err);
        };

        check('foo', /^TypeError: options must be an object$/);
        check({ defaultLevel: 5 }, /^TypeError: defaultLevel must be a string$/);
        check({ defaultLevel: 'zzz' }, /^Error: zzz is not a valid log level$/);
        check({ level: 5 }, /^TypeError: level must be a string$/);
        check({ level: 'zzz' }, /^Error: zzz is not a valid log level$/);
        check({ events: null }, /^TypeError: events must be an array$/);
        check({ events: [5] }, /^TypeError: events\[0\] must be a string$/);
        check({ ignoreChannels: null }, /^TypeError: ignoreChannels must be an array$/);
        check({ ignoreChannels: [5] }, /^TypeError: ignoreChannels\[0\] must be a string$/);
        check({ ignorePaths: null }, /^TypeError: ignorePaths must be an array$/);
        check({ ignorePaths: [5] }, /^TypeError: ignorePaths\[0\] must be a string$/);
        check({ ignoreTags: null }, /^TypeError: ignoreTags must be an array$/);
        check({ ignoreTags: [5] }, /^TypeError: ignoreTags\[0\] must be a string$/);
        check({ logger: null }, /^TypeError: logger must be an object$/);
        check({ logger: 'foo' }, /^TypeError: logger must be an object$/);
        check({ logLevelMap: null }, /^TypeError: logLevelMap must be an object$/);
        check({ logLevelMap: 'foo' }, /^TypeError: logLevelMap must be an object$/);
        check({ logLevelMap: { foo: 'not-valid' } }, /^Error: not-valid is not a valid log level$/);
        check({ onError: 'foo' }, /^TypeError: onError must be a function$/);
        check({ additionalFields: 5 }, /^TypeError: additionalFields must be an object$/);
        check({ additionalFields: null }, /^TypeError: additionalFields must be an object$/);
    });

    it('handles "start" and "stop" events by default', async () => {

        const server = await createServer();

        await server.start();
        await server.stop();
        const events = server.__logger.items;

        Assert.strictEqual(events.length, 4);
        Assert.deepStrictEqual(events[0], 'connect');
        Assert.deepStrictEqual(events[1], ['info', 'server started', undefined, {}]);
        Assert.deepStrictEqual(events[2], ['info', 'server stopped', undefined, {}]);
        Assert.deepStrictEqual(events[3], 'close');
    });

    it('disables "start" and "stop" events', async () => {

        const server = await createServer({
            events: ['log', 'onRequest', 'response']
        });

        await server.start();
        await server.stop();
        const events = server.__logger.items;
        Assert.strictEqual(events.length, 2);
        Assert.deepStrictEqual(events[0], 'connect');
        Assert.deepStrictEqual(events[1], 'close');
    });

    it('changes the default log level', async () => {

        const server = await createServer({ defaultLevel: 'emergency' });

        await server.start();
        await server.stop();
        const events = server.__logger.items;

        Assert.strictEqual(events.length, 4);
        Assert.deepStrictEqual(events[0], 'connect');
        Assert.deepStrictEqual(events[1], ['emergency', 'server started', undefined, {}]);
        Assert.deepStrictEqual(events[2], ['emergency', 'server stopped', undefined, {}]);
        Assert.deepStrictEqual(events[3], 'close');
    });

    it('handles "log" events', async () => {

        const server = await createServer({ events: ['log'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['info', 'foo'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('disables "log" events', async () => {

        const server = await createServer({ events: [] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('ignores "log" events based on channel', async () => {

        const server = await createServer({
            events: ['log'],
            ignoreChannels: ['app']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles "log" events if channel does not match', async () => {

        const server = await createServer({
            events: ['log'],
            ignoreChannels: ['internal']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['info', 'foo'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('ignores "log" events based on tags', async () => {

        const server = await createServer({
            events: ['log'],
            ignoreTags: ['foo']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles "log" events if tags do not match', async () => {

        const server = await createServer({
            events: ['log'],
            ignoreTags: ['not-a-match']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['info', 'foo'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('ignores "log" events that do not meet threshold', async () => {

        const server = await createServer({
            events: ['log'],
            level: 'alert'
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles log level precedence in "log" events', async () => {

        const server = await createServer({ events: ['log'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/error'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'error');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['info', 'error', 'debug'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('uses default log level in "log" events', async () => {

        const server = await createServer({
            defaultLevel: 'emergency',
            events: ['log']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/default/level'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'emergency');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['foo'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('default log level mappings can be unset', async () => {

        // The route in this test has 'error', 'info', and 'debug' tags. Set the
        // default level to something else and unset the mapping for the three tags
        // that are used.
        const server = await createServer({
            events: ['log'],
            defaultLevel: 'alert',
            logLevelMap: {
                error: null,
                info: undefined,
                debug: null
            }
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/error'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'alert');
        Assert.strictEqual(type, 'log event');
        validateObject(event, {
            timestamp: kAnyValue,
            tags: ['info', 'error', 'debug'],
            data: 'server.log() from handler',
            channel: 'app'
        });
    });

    it('handles "onRequest"', async () => {

        const server = await createServer({ events: ['onRequest'] });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, payload] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request received');
        Assert(typeof payload === 'string' && payload.length > 0);
    });

    it('ignores "onRequest" based on path', async () => {

        const server = await createServer({
            events: ['onRequest'],
            ignorePaths: ['/simple']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles "response" events', async () => {

        const server = await createServer({ events: ['response'] });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request completed');
    });

    it('ignores "response" events based on path', async () => {

        const server = await createServer({
            events: ['response'],
            ignorePaths: ['/simple']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles "response" events if ignore paths does not match', async () => {

        const server = await createServer({
            events: ['response'],
            ignorePaths: ['/does-not-match']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request completed');
    });

    it('ignores "response" events based on tags', async () => {

        const server = await createServer({
            events: ['response'],
            ignoreTags: ['foo']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/route/with/tags'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        Assert.strictEqual(server.__logger.items.length, 0);
    });

    it('handles "response" events if ignore tags does not match', async () => {

        const server = await createServer({
            events: ['response'],
            ignoreTags: ['does-not-match']
        });
        let res = await server.inject({
            method: 'GET',
            url: '/route/with/tags'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);

        res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        const items = server.__logger.items;
        Assert.strictEqual(items.length, 2);
        Assert.strictEqual(items[0].length, 4);
        const [level, type] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request completed');
        Assert.deepStrictEqual(items[1][0], 'info');
        Assert.deepStrictEqual(items[1][1], 'request completed');
    });

    it('can handle "error" events from the underlying logger', () => {

        return new Promise((resolve, reject) => {

            const logger = new MockLogger();
            const testError = new Error('test error');

            createServer({
                logger,
                onError(err) {

                    Assert.strictEqual(err, testError);
                    resolve();
                }
            });

            logger.emit('error', testError);
        });
    });

    it('supports request.log()', async () => {

        const server = await createServer({ events: ['request'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/request/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request log event');
        validateObject(event, {
            request: kAnyValue,
            timestamp: kAnyValue,
            tags: ['info', 'foo'],
            data: 'request.log() from handler',
            channel: 'app'
        });
    });

    it('supports request.log() with default log level', async () => {

        const server = await createServer({ events: ['request'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/request/logs/default/level'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request log event');
        validateObject(event, {
            request: kAnyValue,
            timestamp: kAnyValue,
            tags: ['foo'],
            data: 'request.log() from handler',
            channel: 'app'
        });
    });

    it('supports errors in requests', async () => {

        const server = await createServer({ events: ['request'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/request/throws'
        });

        Assert.strictEqual(res.statusCode, 500);
        const items = server.__logger.items;
        // Length is two because hapi has "handler error" and "internal error"
        Assert.strictEqual(items.length, 2);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event] = items[0];
        Assert.strictEqual(level, 'error');
        Assert.strictEqual(type, 'request error');
        validateObject(event, {
            request: kAnyValue,
            timestamp: kAnyValue,
            tags: ['handler', 'error'],
            error: kAnyValue,
            channel: 'internal'
        });
    });

    it('can ignore "request" events based on path', async () => {

        const server = await createServer({
            events: ['request'],
            ignorePaths: ['/handler/that/request/logs/info']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/request/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 0);
    });

    it('can ignore "request" events based on event', async () => {

        const server = await createServer({
            events: ['request'],
            ignoreChannels: ['app']
        });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/request/logs/info'
        });

        Assert.strictEqual(res.payload, 'success');
        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 0);
    });

    it('validates "response" payload format', async () => {

        const server = await createServer({
            events: ['response'],
            additionalFields: { pid: process.pid }
        });
        const res = await server.inject({
            method: 'POST',
            url: '/handler/with/payload?q=1&x=9',
            headers: { 'x-test-header': 'abc123' },
            payload: {
                foo: 'abc',
                bar: 5,
                baz: true
            }
        });

        Assert.strictEqual(res.statusCode, 200);
        const items = server.__logger.items;
        Assert.strictEqual(items.length, 1);
        Assert.strictEqual(items[0].length, 4);
        const [level, type, event, additionalFields] = items[0];
        Assert.strictEqual(level, 'info');
        Assert.strictEqual(type, 'request completed');
        Assert(typeof event.req.id === 'string');
        Assert.strictEqual(event.req.method, 'post');
        Assert.strictEqual(event.req.path, '/handler/with/payload');
        Assert.strictEqual(event.req.headers['x-test-header'], 'abc123');
        Assert.deepEqual(event.req.query, { q: '1', x: '9' });
        Assert.deepStrictEqual(event.req.payload, {
            foo: 'abc',
            bar: 5,
            baz: true
        });
        Assert.strictEqual(event.res.statusCode, 200);
        Assert(typeof event.res.headers === 'object' && event.res.headers !== null);
        Assert(Number.isSafeInteger(event.responseTime));
        Assert.deepStrictEqual(additionalFields, { pid: process.pid });
    });
});
