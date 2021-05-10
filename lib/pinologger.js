'use strict';

const EventEmitter = require('events');
const Hoek = require('@hapi/hoek');

const internals = {};

class Pinologger extends EventEmitter {
    constructor(stdout) {

        super();
        this.stdout = stdout;
    }
}

[
    'emergency',
    'alert',
    'critical',
    'error'
].forEach((level) => {

    Pinologger.prototype[level] = function (msg, data, additionalFields) {

        const stringified = internals.stringify(level, msg, data, additionalFields);
        this.stdout.write(`${stringified}\n`);
    };
});

[
    'warning',
    'notice',
    'info',
    'debug',
    'log'
].forEach((level) => {

    Pinologger.prototype[level] = function (msg, data, additionalFields) {

        const stringified = internals.stringify(level, msg, data, additionalFields);
        this.stdout.write(`${stringified}\n`);
    };
});

internals.stringify = function (level, msg, data, additionalFields = {}) {

    let pinoLevel = 30;
    switch (level) {
        case 'log':
            pinoLevel = 10;
            break;
        case 'debug':
            pinoLevel = 20;
            break;
        case 'info':
            pinoLevel = 30;
            break;
        case 'notice':
        case 'warning':
            pinoLevel = 40;
            break;
        case 'error':
            pinoLevel = 50;
            break;
        default:
            pinoLevel = 60;
    }

    const obj = {
        level: pinoLevel,
        time: Date.now(),
        msg
    };
    Hoek.merge(obj, additionalFields);
    if (data !== undefined && data !== null) {
        obj.data = data;
    }

    return Hoek.stringify(obj);
};

module.exports = Pinologger;
