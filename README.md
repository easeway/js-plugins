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
and the value can be a path to the actual script file or a name representing an attribute from the object provided by `index.js`.

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

```javascript
var Plugins = require('js-plugins');
var pluginManager = new Plugins();
```

From `pluginManager`, we can

#### Register a plugin

```javascript
pluginManager.register(extensionPoint, name, factory);
```

to register a plugin mapped to `extensionPoint/name`.
The `factory` is defined in two forms distinguished by the number of arguments:

```javascript
function factory(data, host, options, callback);    // the async version, the extension is created asynchronously
                                                    // callback is defined as function callback(err, extension)
function factory(data, host, options);              // the sync version, the extension is returned directly
```

Factories with argument number less than 3 are treated as sync version.
The parameters are defined as:

- `data`: opaque data which is recognized by **host** and **plugin**
- `host`: instance of **host**
- `options`: additional information, currently defined
    * `extensionPoint`: name of extension-point
    * `name`: name of extension
- `callback`: for receiving the extension, in the form of `function (err, extension)`

#### Create extensions

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

**js-plugins** is not needed. The only thing to do is presenting `extensions` section in `package.json`.

The `extensions` section is a hash with each key as an extension-point, and the value is also another hash
with each key as extension name. The value can be in several form:

- hash: this is the complete form, it defines 2 attributes:
    * `module`: if present, specify the path of script file which will be loaded using `require`, otherwise the top directory (containing `package.json`) is required;
    * `object`: when present, it means the required module doesn't provide a factory directory, but must use the value of `object` to get the factory
- string without '/': equals to hash form without `module` but `object`
- string with '/': equals to hash form with `module` but no `object`

See above to find out how to define a factory.

## License

MIT/X11 License
