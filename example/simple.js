'use strict';

const Hapi = require('@hapi/hapi');
const Log = require('../lib');

const main = async () => {

    // Include these additional fields in the logger output JSON
    const additionalFields = { name: 'example', pid: process.pid };

    const server = new Hapi.Server({ port: 8080 });
    await server.register({ plugin: Log, options: { additionalFields } });

    server.route({ method: 'GET', path: '/', handler: () => 'success' });
    server.route({ method: 'GET', path: '/err', handler: () => new Error('foo') });
    await server.start();
};

main();
