---
category: features
path: /features/protocols
title: "Protocols"
---

```toc
# This code block gets replaced with the Table of Contents
```

## Table

The following protocols can be used by any dependency entry listed in the `dependencies` or `devDependencies` fields. While they work regardless of the context we strongly recommend you to only use semver ranges on published packages as they are the one common protocol whose semantic is clearly defined across all package managers.

| Name          | Example                                 | Description                                                                                                                     |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Semver        | `^1.2.3`                                | Resolves from the default registry                                                                                              |
| Tag           | `latest`                                | Resolves from the default registry                                                                                              |
| Npm alias     | `npm:name@...`                          | Resolves from the npm registry                                                                                                  |
| GitHub        | `foo/bar`                               | Alias for the `github:` protocol                                                                                                |
| GitHub        | `github:foo/bar`                        | Downloads a **public** package from GitHub                                                                                      |
| File          | `file:./my-package`                     | Copies the target location into the cache                                                                                       |
| Link          | `link:./my-folder`                      | Creates a link to the `./my-folder` folder (ignore dependencies)                                                                |
| Patch         | `patch:left-pad@1.0.0#./my-patch.patch` | Creates a patched copy of the original package                                                                                  |
| Portal        | `portal:./my-folder`                    | Creates a link to the `./my-folder` folder (follow dependencies)                                                                |
| [Exec](#exec) | `exec:./my-generator-package`           | <sup>*Experimental & Plugin*</sup><br>Instructs Yarn to execute the specified Node script and use its output as package content |

## Details

### Exec

> **Experimental**
>
> This feature is still incubating, and we'll likely be improving it based on your feedback.

> **Plugin**
>
> To use this protocol, first install the `exec` plugin: `yarn plugin import exec`

**Usage**

`package.json`

```json
{
  "dependencies": {
    "pkg": "exec:./gen-pkg.js"
  }
}
```

`gen-pkg.js`

```js
const {mkdirSync, writeFileSync} = require(`fs`);
const {tempDir} = execEnv;

// Can also be written as `mkdirSync(`build`);`
// since the script is executed in the temporary directory
mkdirSync(`${tempDir}/build`);

writeFileSync(`${tempDir}/build/package.json`, JSON.stringify({
  name: `pkg`,
  version: `1.0.0`,
}));

writeFileSync(`${tempDir}/build/index.js`, `module.exports = ${Date.now()};\n`);
```

**Documentation**

The script will be invoked inside a temporary directory (`execEnv.tempDir`) with two parameters: the generator path (`process.argv[1]`) and the stringified [`Ident`](/api/interfaces/yarnpkg_core.ident.html) identifying the generator package (`process.argv[2]`).

You're free to do whatever you want inside the temporary directory, but, at the end of the execution, Yarn will expect a `build` directory to have been created inside it that will then be compressed into an archive and stored within the cache.

Yarn injects the `execEnv` global variable inside the script. It's an `object` that contains various useful details about the execution context. We also provide type definitions through the [`ExecEnv`](/api/interfaces/plugin_exec.execenv.html) interface from `@yarnpkg/plugin-exec`.

| Property        | Type                                                       | Description                                                                                   |
| --------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tempDir`       | [`NativePath`](/api/modules/yarnpkg_fslib.html#nativepath) | The absolute path of the temporary directory where the script runs. Equal to `process.cwd()`. |
| `locator`       | [`Locator`](/api/interfaces/yarnpkg_core.locator.html)     | The `Locator` identifying the generator package.                                              |
| `generatorPath` | [`NativePath`](/api/modules/yarnpkg_fslib.html#nativepath) | The absolute path of the generator file. Equal to `process.argv[1]`.                          |
| `logDir`        | [`NativePath`](/api/modules/yarnpkg_fslib.html#nativepath) | The absolute path of the build log directory.                                                 |
| `logFile`       | [`NativePath`](/api/modules/yarnpkg_fslib.html#nativepath) | The absolute path of the build log.                                                           |
| `logs`          | `string`                                                   | The content of the build log. It's a `getter`, so the value is dynamic.                       |

## Questions & Answers

### Why can't I add dependencies through the `patch:` protocol?

A Yarn install is split across multiple steps (described [here](/advanced/architecture#install-architecture)). Most importantly, we first fully resolve the dependency tree, and only then do we download the packages from their remote sources. Since patches occur during this second step, by the time we inject the new dependencies it's already too late as the dependency tree has already been frozen.

In order to add dependencies to a package, either fork it (and reference it through the Git protocol, for example), or use the [`packageExtensions`](/configuration/yarnrc#packageExtensions) mechanism which is specifically made to add new runtime dependencies to packages.

### What's the difference between `link:` and `portal:`?

The `link:` protocol is meant to link a package name to a folder on the disk - any folder. For example one perfect use case for the `link:` protocol is to map your `src` folder to a clearer name that you can then use from your Node applications without having to use relative paths (for example you could link `my-app` to `link:./src` so that you can call `require('my-app')` from any file within your application).

Because such destination folders typically don't contain `package.json`, the `link:` protocol doesn't even try to read them. It can cause problems when you want to link an identifier to a different *package* on the disk (similar to what `yarn link` does), because then the transitive dependencies aren't resolved.

In order to solve this use case, the new `portal:` protocol available in the v2 opens a portal to any package located on your disk. Because portals are meant to only target packages they can leverage the information from the `package.json` files listed within their targets to properly resolve transitive dependencies.
