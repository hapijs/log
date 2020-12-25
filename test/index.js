'use strict';

const { expect } = require('@hapi/code');
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

            await expect((() => {

                return server.register({ plugin: Plugin, options });
            })()).to.reject(err);
        };

        check('foo', /^options must be an object$/);
        check({ defaultLevel: 5 }, /^defaultLevel must be a string$/);
        check({ defaultLevel: 'zzz' }, /^zzz is not a valid log level$/);
        check({ level: 5 }, /^level must be a string$/);
        check({ level: 'zzz' }, /^zzz is not a valid log level$/);
        check({ events: null }, /^events must be an array$/);
        check({ events: [5] }, /^events\[0\] must be a string$/);
        check({ ignoreChannels: null }, /^ignoreChannels must be an array$/);
        check({ ignoreChannels: [5] }, /^ignoreChannels\[0\] must be a string$/);
        check({ ignorePaths: null }, /^ignorePaths must be an array$/);
        check({ ignorePaths: [5] }, /^ignorePaths\[0\] must be a string$/);
        check({ ignoreTags: null }, /^ignoreTags must be an array$/);
        check({ ignoreTags: [5] }, /^ignoreTags\[0\] must be a string$/);
        check({ logger: null }, /^logger must be an object$/);
        check({ logger: 'foo' }, /^logger must be an object$/);
        check({ logLevelMap: null }, /^logLevelMap must be an object$/);
        check({ logLevelMap: 'foo' }, /^logLevelMap must be an object$/);
        check({ logLevelMap: { foo: 'not-valid' } }, /^not-valid is not a valid log level$/);
        check({ onError: 'foo' }, /^onError must be a function$/);
        check({ additionalFields: 5 }, /^additionalFields must be an object$/);
        check({ additionalFields: null }, /^additionalFields must be an object$/);
    });

    it('handles "start" and "stop" events by default', async () => {

        const server = await createServer();

        await server.start();
        await server.stop();
        const events = server.__logger.items;

        expect(events.length).to.equal(4);
        expect(events[0]).to.equal('connect');
        expect(events[1]).to.equal(['info', 'server started', undefined, {}]);
        expect(events[2]).to.equal(['info', 'server stopped', undefined, {}]);
        expect(events[3]).to.equal('close');
    });

    it('disables "start" and "stop" events', async () => {

        const server = await createServer({
            events: ['log', 'onRequest', 'response']
        });

        await server.start();
        await server.stop();
        const events = server.__logger.items;
        expect(events.length).to.equal(2);
        expect(events[0]).to.equal('connect');
        expect(events[1]).to.equal('close');
    });

    it('changes the default log level', async () => {

        const server = await createServer({ defaultLevel: 'emergency' });

        await server.start();
        await server.stop();
        const events = server.__logger.items;

        expect(events.length).to.equal(4);
        expect(events[0]).to.equal('connect');
        expect(events[1]).to.equal(['emergency', 'server started', undefined, {}]);
        expect(events[2]).to.equal(['emergency', 'server stopped', undefined, {}]);
        expect(events[3]).to.equal('close');
    });

    it('handles "log" events', async () => {

        const server = await createServer({ events: ['log'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/info'
        });

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
    });

    it('handles log level precedence in "log" events', async () => {

        const server = await createServer({ events: ['log'] });
        const res = await server.inject({
            method: 'GET',
            url: '/handler/that/server/logs/error'
        });

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('error');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('emergency');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('alert');
        expect(type).to.equal('log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, payload] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request received');
        expect(typeof payload === 'string' && payload.length > 0).to.be.true();
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
    });

    it('handles "response" events', async () => {

        const server = await createServer({ events: ['response'] });
        const res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request completed');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request completed');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        expect(server.__logger.items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);

        res = await server.inject({
            method: 'GET',
            url: '/simple'
        });

        const items = server.__logger.items;
        expect(items.length).to.equal(2);
        expect(items[0].length).to.equal(4);
        const [level, type] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request completed');
        expect(items[1][0]).to.equal('info');
        expect(items[1][1]).to.equal('request completed');
    });

    it('can handle "error" events from the underlying logger', () => {

        return new Promise((resolve, reject) => {

            const logger = new MockLogger();
            const testError = new Error('test error');

            createServer({
                logger,
                onError(err) {

                    expect(err).to.shallow.equal(testError);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request log event');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request log event');
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

        expect(res.statusCode).to.equal(500);
        const items = server.__logger.items;
        // Length is two because hapi has "handler error" and "internal error"
        expect(items.length).to.equal(2);
        expect(items[0].length).to.equal(4);
        const [level, type, event] = items[0];
        expect(level).to.equal('error');
        expect(type).to.equal('request error');
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(0);
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

        expect(res.payload).to.equal('success');
        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(0);
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

        expect(res.statusCode).to.equal(200);
        const items = server.__logger.items;
        expect(items.length).to.equal(1);
        expect(items[0].length).to.equal(4);
        const [level, type, event, additionalFields] = items[0];
        expect(level).to.equal('info');
        expect(type).to.equal('request completed');
        expect(typeof event.req.id).to.equal('string');
        expect(event.req.method).to.equal('post');
        expect(event.req.path).to.equal('/handler/with/payload');
        expect(event.req.headers['x-test-header']).to.equal('abc123');
        expect(event.req.query).to.equal({ q: '1', x: '9' });
        expect(event.req.payload).to.equal({
            foo: 'abc',
            bar: 5,
            baz: true
        });
        expect(event.res.statusCode).to.equal(200);
        expect(typeof event.res.headers === 'object' && event.res.headers !== null).to.be.true();
        expect(Number.isSafeInteger(event.responseTime)).to.be.true();
        expect(additionalFields).to.equal({ pid: process.pid });
    });
});
