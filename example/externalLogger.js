'use strict';

const Net = require('net');
const { PassThrough } = require('stream');
const Hapi = require('@hapi/hapi');
const Log = require('../lib');

const main = async () => {

    // Use the StdLogger with a passthrough stream for out/err
    const logStream = new PassThrough();
    const logger = new Log.Stdlogger(logStream, logStream);

    const broadcastServer = Net.createServer((socket) => {

        logStream.pipe(socket);
    }).on('error', (err) => {

        throw err;
    });

    broadcastServer.listen(() => {

        console.log('To see log output connect netcat to the listener:');
        console.log('nc localhost', broadcastServer.address().port);
    });

    // Include these additional fields in the logger output JSON
    const additionalFields = { name: 'example', pid: process.pid };

    const server = new Hapi.Server({ port: 8080 });
    await server.register({ plugin: Log, options: { additionalFields, logger } });

    server.route({ method: 'GET', path: '/', handler: () => 'success' });
    server.route({ method: 'GET', path: '/err', handler: () => new Error('foo') });
    await server.start();
};

main();
