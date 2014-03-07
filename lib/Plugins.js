/** @fileoverview
 * Provide Plugins
 */

var Class = require('js-class'),
    fs    = require('fs'),
    path  = require('path'),
    flow  = require('js-flow');

function wrapFactory(factory) {
    if (typeof(factory) == 'function') {
        if (factory.length < 4) {
            return function (data, host, info, callback) {
                var instance = factory(data, host, info);
                callback(null, instance);
            };
        } else {
            return factory;
        }
    } else {
        return function (data, host, info, callback) { callback(); return null; }
    }
}

/** @class ModulePlugin
 * Plugin loaded from a Node.js module
 */
var ModulePlugin = Class({
    constructor: function (base, info) {
        this._baseDir = base;
        this._info = info;
    },

    create: function (data, host, info, callback) {
        var factory, moduleFile, object;

        if (typeof(this._info) == 'string') {
            if (this._info.indexOf('/') >= 0) {
                moduleFile = path.resolve(this._baseDir, this._info);
            } else {
                moduleFile = this._baseDir;
                object = this._info;
            }
        } else {
            moduleFile = typeof(this._info.module) == 'string' ? path.resolve(this._baseDir, this._info.module) : this._baseDir;
            object = this._info.object;
        }

        try {
            factory = require(moduleFile);
        } catch (e) {
            // ignored
        }

        if (factory && typeof(object) == 'string') {
            factory = factory[object];
        }

        this.create = wrapFactory(factory);
        return this.create.apply(this, arguments);
    }
}, {
    statics: {
        factory: function (base, info) {
            var plugin = new ModulePlugin(base, info);
            var factory = function (data, host, info, callback) {
                return this.create.apply(this, arguments);
            }.bind(plugin);
            if (typeof(info) == 'object') {
                info.auto !== undefined && (factory.auto = info.auto);
            }
            return factory;
        }
    }
});

/** @class Plugins
 * This is a root scope for all plugins and provides
 * functionalities for connecting extensions with consumers.
 */
var Plugins = Class({
    constructor: function () {
        this.section = 'extensions';
        this._extensions = {};
    },

    /** @function
     * @description Register an extension.
     *
     * @param {String} extensionPoint   Name of extension point
     * @param {String} name             Name of extension
     * @param {Function} factory        Factory to instantiate the extension.
     */
    register: function (extensionPoint, name, factory) {
        if (typeof(factory) != 'function') {
            throw new Error('Plugin factory is not a function');
        }
        var exts = this._extensions[extensionPoint];
        if (!exts) {
            exts = this._extensions[extensionPoint] = [];
            exts.names = {};
        }
        exts.names[name] || exts.push(name);
        exts.names[name] = wrapFactory(factory);
        return this;
    },

    /** @function
     * @description Create extensions on specified extensionPoint
     *
     * @param {object} host the consumer of extensionPoint
     * @param {String} extenionPoint name of extension point
     * @param {object} options defined as
     *                   - data passed to extension factory
     *                   - multi when true, connect all available extensions
     *                           when false, the first extension is connected
     *                   - name when is a string, explicitly specify the named plugin
     *                          when is an array, alternatives are considered
     *                   - required when true, error is thrown if no extensions found
     *                   - onerror an optional function invoked for error encountered when
     *                          loading and extension, the error may indicate the extension
     *                          doesn't support current environment but not the failure of
     *                          the connecting process.
     * @param {Function} callback receiver of created plugins
     *
     * @returns when multi is true, an array of extensions is returned,
     *          otherwise, only a single extension or null is returned.
     */
    connect: function (host, extensionPoint, options, callback) {
        if (typeof(options) == 'function') {
            callback = options;
            options = {};
        }
        options || (options = {});
        var exts = this._extensions[extensionPoint];
        var data = options.data;

        var instantiateOne = function (name, callback) {
            var factory = exts.names[name];
            if (typeof(factory) == 'function' &&
                (options.name || factory.auto !== false)) {
                var info = { extension: extensionPoint, name: name };
                factory(data, host, info, function (err, instance) {
                    err && typeof(options.onerror) == 'function' && options.onerror(err, info);
                    callback(null, { instance: err ? null : instance, name: name });
                });
            } else {
                callback(null, {});
            }
        };

        var complete = function (instances) {
            var err = instances.length == 0 && options.required ? new Error('Extension not found for ' + extensionPoint) : null;
            if (options.multi) {
                callback(err,
                         instances.map(function (inst) { return inst.instance; }),
                         instances.map(function (inst) { return inst.name; })
                        );
            } else if (instances[0]) {
                callback(err, instances[0].instance, instances[0].name);
            } else {
                callback(err, null, null);
            }
        };

        var instantiate = options.multi ? function (names) {
            flow.each(names).map(function (name, next) {
                instantiateOne(name, next);
            }).run(function (err, instances) {
                complete(instances.filter(function (instance) { return instance.instance != null; }));
            });
        } : function (names) {
            var instances = [];
            flow.each(names).do(function (name, next) {
                instances.length > 0 ? next() : instantiateOne(name, function (err, instance) {
                    !err && instance.instance && instances.push(instance);
                    next();
                });
            }).run(function () { complete(instances); });
        };

        if (exts) {
            if (options.name) {
                var names = options.name;
                Array.isArray(names) || (names = [names]);
                instantiate(names);
            } else {
                instantiate(exts);
            }
        } else {
            complete([]);
        }

        return this;
    },

    scanSubdirs: function (dirs) {
        Array.isArray(dirs) || (dirs = [dirs]);
        for (var n in dirs) {
            var dir = dirs[n], subdirs;
            try {
                subdirs = fs.readdirSync(dir);
            } catch (e) {
                // ignore invalid dirs
                continue;
            }

            for (var i in subdirs) {
                this.loadPackage(path.join(dir, subdirs[i]));
            }
        }
        return this;
    },

    scan: function () {
        // scan directories are in reverse order of
        // module loading
        var dirs = [], mainDir;
        process.config && process.config.variables &&
            dirs.push(path.join(process.config.variables.node_prefix, 'lib/node_modules'));
        if (process.env.HOME) {
            dirs.push(path.join(process.env.HOME, '.node_libraries'));
            dirs.push(path.join(process.env.HOME, '.node_modules'));
        }
        if (require.main && Array.isArray(require.main.paths)) {
            dirs = dirs.concat(require.main.paths.slice().reverse());
            require.main.paths[0] && (mainDir = path.dirname(require.main.paths[0]));
        }
        this.scanSubdirs(dirs);
        mainDir && this.loadPackage(mainDir);
        return this;
    },

    loadPackage: function (dir) {
        var metadata;
        try {
            metadata = fs.readFileSync(path.join(dir, 'package.json'));
            metadata = JSON.parse(metadata);
        } catch (e) {
            // ignore invalid modules
        }
        var exts = metadata && metadata[this.section];
        if (typeof(exts) == 'object') {
            for (var extPoint in exts) {
                var ext = exts[extPoint];
                if (typeof(ext) != 'object') {
                    continue;
                }
                for (var name in ext) {
                    var extInfo = ext[name];
                    this.register(extPoint, name, ModulePlugin.factory(dir, extInfo));
                }
            }
        }
    }
}, {
    statics: {
        /** @property {Plugins} instance The global instance */
        get instance() {
            var inst = global['js-plugins:Plugins'];
            inst || (inst = global['js-plugins:Plugins'] = new Plugins());
            return inst;
        },

        register: function () {
            var inst = Plugins.instance;
            return inst.register.apply(inst, arguments);
        },

        connect: function () {
            var inst = Plugins.instance;
            return inst.connect.apply(inst, arguments);
        }
    }
});

module.exports = Plugins;
