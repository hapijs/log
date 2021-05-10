'use strict';

const { expect } = require('@hapi/code');
const Lab = require('@hapi/lab');
const { Pinologger } = require('../lib');
const { captureStd } = require('./helpers');

const { describe, it } = exports.lab = Lab.script();


describe('Pinologger', () => {

    it('logs all levels to stdout', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.info('my msg');
        logger.error('my error');
        const result = std.complete();
        expect(result.output).to.contain('my msg');
        expect(result.output).to.contain('my error');
    });

    it('formats additional fields on top level object', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.info('my msg', null, { test: 'test' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"test":"test"');
    });

    it('uses pino log level in output', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.info('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"level":30');
    });

    it('uses pino log level for log', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.log('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"level":10');
    });

    it('uses pino log level for debug', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.debug('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"level":20');
    });

    it('uses pino log level for warning', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.warning('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"level":40');
    });

    it('uses pino log level for emergency', () => {

        const std = captureStd();
        const logger = new Pinologger(std.stdout);
        logger.emergency('my msg', { foo: 'bar' });
        const result = std.complete();
        expect(result.output).to.contain('"msg":"my msg"');
        expect(result.output).to.contain('"level":60');
    });
});
