'use strict';

const EventEmitter = require('events');
const Hoek = require('@hapi/hoek');

const internals = {};

class Stdlogger extends EventEmitter {
    constructor(stdout, stderr) {

        super();
        this.stdout = stdout;
        this.stderr = stderr;
    }
}

[
    'emergency',
    'alert',
    'critical',
    'error'
].forEach((level) => {

    Stdlogger.prototype[level] = function (msg, data, additionalFields) {

        const stringified = internals.stringify(level, msg, data, additionalFields);
        this.stderr.write(`${stringified}\n`);
    };
});

[
    'warning',
    'notice',
    'info',
    'debug',
    'log'
].forEach((level) => {

    Stdlogger.prototype[level] = function (msg, data, additionalFields) {

        const stringified = internals.stringify(level, msg, data, additionalFields);
        this.stdout.write(`${stringified}\n`);
    };
});

internals.stringify = function (level, msg, data = null, additionalFields = {}) {

    const obj = {
        level,
        time: Date.now(),
        msg
    };
    Hoek.merge(obj, additionalFields);

    if (data !== null) {
        obj.data = data;
    }

    return Hoek.stringify(obj);
};

module.exports = Stdlogger;
