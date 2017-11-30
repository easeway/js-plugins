[![Build Status](https://travis-ci.org/easeway/js-plugins.png?branch=master)](https://travis-ci.org/easeway/js-plugins)

# Open Plugin Framework for Node.js

This module is an extension-point based framework for loading plugins, inspired by Eclipse plugin system.

The scenario can explain why this module is developed:

Developer A made an excellent text editor which can be installed using

```javascript
npm install xedit -g
```

Developer B is a language expert and he invents a new language.
He loves *xedit* so much that he wants to make a plugin for it.
A few days later, he published a module called `xedit-lang-x`.

User simply use

```javascript
npm install xedit -g
npm install xedit-lang-x -g
```

than, *xedit* automatically recognized language *x*.

# How it works

## Concepts

### Host

**host** is the consumer of extension instances.

### Plugin

A **plugin** is a library/module providing a few **extensions** for certain
**extension-points**.

### ExtensionPoint

**extension-point** is the abstract name indicating a feature/function can be
extended by an extension.
The names are application specific,
and is used as a contract between **host** and **extensions**.

### Extension

**extension** provides specific logic to extend the feature/function defined
by **extension-point** and consumed by **host**.
The logic is provided by registering a factory function which creates an
instance of the extension to implement the logic
(providing methods, fields according to certain contract).

### ExtensionName

There can be multiple extensions associated with a single **extension-point**,
and each extension is identified by a **name** which must be unique per one
extension-point.

## Example

In the scenario above, *xedit* scans and loads plugins.
In this way, *xedit* is called **host** in this framework.
And *xedit-lang-x* is a **plugin**.
A **host** will require **js-plugins** to manage plugins,
while a **plugin** doesn't require **js-plugins** but need a special section in `package.json` to describe what the plugin provides.

Here's an example what *xedit-lang-x* written in the `package.json`:

```json
{
    "name": "xedit-lang-x",
    ...
    "extensions": {
        "xedit:language": {
            "x": "./lib/xedit-lang-plugin"
        }
    }
}
```

In the example above, section `extensions` defines what extensions are provided by this module.
The key of the hash is the extension-point name,
and the value is a dictionary mapping from extension names to factories.

There are two ways to specify the factory.
As in the above example `./lib/xedit-lang-plugin` specifies the javascript file which exports the factory function.
Or a plain name without embedded `/` indicates `index.js` which exports the factory function.

The file `./lib/xedit-lang-plugin.js` will exports a factory function:

```javascript
...

module.exports = function() {
    return new ExtensionLangX();
}
```

Alternatively, the factory can be specified in a more detailed form:

```json
{
    "name": "xedit-lang-x",
    ...
    "extensions": {
        "xedit:language": {
            "x": {
              "module": "./lib/xedit-lang-multi-plugin",
              "object": "langx"
            }
        }
    }
}
```

The above example specifies a javascript module which is interpreted the same way described above
except the module exports a dictionary instead of a function,
and use `object` to specify the key in the dictionary to retrieve the factory function.

In this case, the file `./lib/xedit-lang-multi-plugin.js` will exports an dictionary:

```javascript
...
module.exports = {
    "langx": function() { return new ExtensionLangX(); },
};
```

## Factory function

The factory function can be defined in synchronous or asynchronous way:

```javascript
function extensionFactoryAsync(data, host, info, callback) { }
function extensionFactorySync(data, host, info) { }
```

For parameters:

- `data`: the opaque data provided by **host** (via `options` calling `connect`) when connecting the extension;
- `host`: the **host** object
- `info`: is an object defining **extension-point** and name of extension:

```json
{
    "extension": "extension-point",
    "name": "extension-name",
}
```

When `callback` is specified, the factory should return extension instance to
`callback` which is defined as `function callback(err, instance)`.
Without `callback`, the instance should be returned immediately.

## Loading plugins

When *xedit* starts, it uses **js-plugins** to scan all installed modules and find out all available extensions from `package.json` files.
When it is going to load a language plugin, it uses extension-point name `xedit:language` to load all matched extensions.

By default, **js-plugins** scans the following locations in sequence (latter ones may override former ones):

- `node_prefix/lib/node_modules/*/package.json`
- `$HOME/.node_libraries/*/package.json`
- `$HOME/.node_modules/*/package.json`
- `require.main.paths/*/package.json`
- `require.main.paths[0]/package.json`

# Usage

### **host** side

**js-plugins** provides a simple class `Plugins`:

#### Simplest Usage

```javascript
var pluginManager = require('js-plugins').instance;
pluginManager.scan();
pluginManager.connect(host, extensionPoint, options, function (err, instance) {});
```

#### More complicated

```javascript
var Plugins = require('js-plugins');

// create own instance instead of using the default one
var pluginManager = new Plugins();
```

From `pluginManager`, we can

#### Register a plugin

```javascript
pluginManager.register(extensionPoint, name, factory);
```

to register a plugin mapped to `extensionPoint/name`.

#### Connect extensions

```javascript
pluginManager.connect(host, extensionPoint, options, callback)
```

The parameters are defined as:

- `host`: the **host** instance
- `extensionPoint`: name of extension-point
- `options`: a hash defined as
    * `data`: passed to extension factory as the first argument
    * `multi`: when true, connect all available extensions registered to the same extension-point, when false, the first extension is connected
    * `name`: when is a string, explicitly specify the name of the extension, when is an array, names are iterated until an extension is connected
    * `required`: when true, error is thrown if no extensions found
- `callback`: defined as `function (err, extensions)`, it is possible `extenions` is a single instance or an array when `multi` is `true`.

#### Scan directories

```javascript
pluginManager.scanSubdirs(dirs)
```

`dirs` is an array of directories, under each the first level sub-directories are scanned for `package.json`.

#### Scan all default directory

```javascript
pluginManager.scan()
```

It scans all default directories in the sequence described above.
The latter modules may override the former ones if the same extension-point + name is registered.

`Plugins` provides a global instance which can be accessed using `Plugins.instance`.
All methods are promoted under `Plugins` directly. E.g. `Plugins.scan` is equivalent to `Plugins.instance.scan`. The recommended practise is to use the global instance as much as possible, and invoke `Plugins.scan` once at application start-up.

### **plugin** side

See above example of `xedit-lang-x` about writing a plugin.

## License

MIT/X11 License
