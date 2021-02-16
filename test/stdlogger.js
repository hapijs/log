'use strict';

const { expect } = require('@hapi/code');
const Lab = require('@hapi/lab');
const Stdlogger = require('../lib/stdlogger');
const { captureStd } = require('./helpers');

const { describe, it } = exports.lab = Lab.script();


describe('Stdlogger', () => {

    it('logs info level to stdout', () => {

        const std = captureStd();
        const logger = new Stdlogger(std.stdout, std.stderr);
        logger.info('my msg');
        const result = std.complete();
        expect(result.output).to.contain('my msg');
    });

    it('logs error level to stderr', () => {

        const std = captureStd();
        const logger = new Stdlogger(std.stdout, std.stderr);
        logger.error('my error');
        const result = std.complete();
        expect(result.errorOutput).to.contain('my error');
    });

    it('formats additional fields on top level object', () => {

        const std = captureStd();
        const logger = new Stdlogger(std.stdout, std.stderr);
        logger.info('my msg', null, { test: 'test' });
        const result = std.complete();
        expect(result.output).to.contain(',"test":"test"');
    });

    it('writes data object to data field', () => {

        const std = captureStd();
        const logger = new Stdlogger(std.stdout, std.stderr);
        logger.info('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"data":{"foo":"bar"}');
    });
});
