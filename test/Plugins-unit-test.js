var assert  = require('assert'),
    sandbox = require('sandboxed-module'),
    flow    = require('js-flow'),
    Plugins = require('..');

describe('Plugins', function () {
    it('global instance', function () {
        assert.strictEqual(Plugins.instance, Plugins.instance);
    });

    it('#register', function (done) {
        var plugins = new Plugins();
        var testPlugin = function () {
            return 'plugin';
        };
        assert.strictEqual(plugins.register('test.extension', 'test', testPlugin), plugins);
        plugins.connect({}, 'test.extension', function (err, result) {
            flow.Try.final(function () {
                assert.equal(result, 'plugin');
            }, done);
        });
    });

    it('#register override', function (done) {
        var plugins = new Plugins();
        var testPlugin1 = function () {
            return 'plugin';
        };
        var testPlugin2 = function () {
            return 'plugin2';
        };

        assert.strictEqual(plugins.register('test.extension', 'test', testPlugin1), plugins);
        assert.strictEqual(plugins.register('test.extension', 'test', testPlugin2), plugins);
        plugins.connect({}, 'test.extension', function (err, result) {
            flow.Try.final(function () {
                assert.equal(result, 'plugin2');
            }, done);
        });
    });

    it('#connect options data', function (done) {
        var plugins = new Plugins();
        var testPlugin = function (data) {
            return data;
        };
        plugins.register('test.extension', 'test', testPlugin);
        plugins.connect({}, 'test.extension', { data: 'data' }, function (err, result) {
            flow.Try.final(function () {
                assert.equal(result, 'data');
            }, done);
        });
    });

    it('#connect options name', function (done) {
        var plugins = new Plugins();
        var testPlugin = function (data) {
            return 'plugin';
        };
        plugins.register('test.extension', 'test', testPlugin);
        var tests = {
            nonexist: null,
            test: 'plugin'
        };
        flow.each(tests).withIndex().do(function (name, test, next) {
            plugins.connect({}, 'test.extension', { name: name }, function (err, result) {
                flow.Try.final(function () { assert.equal(result, test); }, next);
            });
        }).run(done);
    });

    it('#connect options multi', function (done) {
        var plugins = new Plugins();
        var testPlugin1 = function (data) {
            return 'plugin1';
        };
        var testPlugin2 = function (data) {
            return 'plugin2';
        };

        plugins.register('test.extension', 'test1', testPlugin1);
        plugins.register('test.extension', 'test2', testPlugin2);

        plugins.connect({}, 'test.extension', { multi: true }, function (err, result) {
            flow.Try.final(function () {
                assert.deepEqual(result, ['plugin1', 'plugin2']);
            }, done);
        });
    });

    it('#connect alternative', function (done) {
        var plugins = new Plugins();
        var testPlugin1 = function (data) {
            return 'plugin1';
        };
        var testPlugin2 = function (data) {
            return 'plugin2';
        };

        plugins.register('test.extension', 'test1', testPlugin1);
        plugins.register('test.extension', 'test2', testPlugin2);

        var tests = [
            { opts: { name: ['nonexist', 'test2'] }, expects: 'plugin2' },
            { opts: { name: ['test1', 'test2'] }, expects: 'plugin1' },
            { opts: { name: ['test1', 'test2'], multi: true }, expects: ['plugin1', 'plugin2'] }
        ];
        flow.each(tests).do(function (test, next) {
            plugins.connect({}, 'test.extension', test.opts, function (err, result) {
                flow.Try.final(function () {
                    assert.deepEqual(result, test.expects);
                }, next);
            });
        }).run(done);
    });

    it('#scanSubdirs', function () {
        var SandboxedPlugins = sandbox.require('../lib/Plugins', {
            requires: {
                'fs': {
                    readdirSync: function () {
                        return ['a', 'b'];
                    }
                }
            }
        });
        var plugins = new SandboxedPlugins();
        var scanned = [];
        plugins.loadPackage = function (dir) { scanned.push(dir); };

        plugins.scanSubdirs('single');
        plugins.scanSubdirs(['d1', 'd2']);

        assert.deepEqual(scanned, ['single/a', 'single/b', 'd1/a', 'd1/b', 'd2/a', 'd2/b']);
    });

    it('#scan');

    function stubMetadata(metadata) {
        var SandboxedPlugins = sandbox.require('../lib/Plugins', {
            requires: {
                'fs': {
                    readFileSync: function () { return metadata; }
                }
            }
        });
        return new SandboxedPlugins();
    }

    it('#loadPackage', function () {
        var plugins = stubMetadata(JSON.stringify({ extensions: { 'test.a': { 'a': './a', 'b': './b' } } }));
        var regs = [];
        plugins.register = function (extensionPoint, name, factory) {
            regs.push(extensionPoint + '#' + name);
            assert.equal(typeof(factory), 'function');
        };
        plugins.loadPackage('dir');
        assert.deepEqual(regs, ['test.a#a', 'test.a#b']);
    });

    it('#loadPackage no extensions', function () {
        var plugins = stubMetadata(JSON.stringify({ }));
        var regs = [];
        plugins.register = function (extensionPoint, name, factory) {
            regs.push(extensionPoint + '#' + name);
            assert.equal(typeof(factory), 'function');
        };
        plugins.loadPackage('dir');
        assert.deepEqual(regs, []);
    });

    it('#loadPackage invalid extension point', function () {
        var plugins = stubMetadata(JSON.stringify({ extensions: { 'test.a': 'a' } }));
        var regs = [];
        plugins.register = function (extensionPoint, name, factory) {
            regs.push(extensionPoint + '#' + name);
            assert.equal(typeof(factory), 'function');
        };
        plugins.loadPackage('dir');
        assert.deepEqual(regs, []);
    });

    it('#loadPackage invalid metadata', function () {
        var plugins = stubMetadata('invalid');
        var regs = [];
        plugins.register = function (extensionPoint, name, factory) {
            regs.push(extensionPoint + '#' + name);
            assert.equal(typeof(factory), 'function');
        };
        plugins.loadPackage('dir');
        assert.deepEqual(regs, []);
    });
});
