'use strict';

const Hapi = require('@hapi/hapi');
const Log = require('../lib');

const main = async () => {

    const logger = new Log.Pinologger(process.stdout);
    const server = new Hapi.Server({ port: 8080 });
    await server.register({ plugin: Log, options: { logger, level: 'error' } });

    server.route({ method: 'GET', path: '/', handler: () => 'success' });
    server.route({ method: 'GET', path: '/err', handler: () => new Error('foo') });
    await server.start();
};

main();
