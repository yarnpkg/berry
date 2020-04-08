# `@yarnpkg/plugin-exec`

> **Experimental**
>
> This feature is still incubating, and we'll likely be improving it based on your feedback.

This plugin will add support to Yarn for the `exec:` protocol. This protocol is special in that it'll instruct Yarn to execute the specified Node script and use its output as package content (thus treating the script as a kind of package factory).

## Install

```
yarn plugin import exec
```

## Usage

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

## Documentation

The script will be invoked inside a temporary directory (`execEnv.tempDir`) with two parameters: the generator path (`process.argv[1]`) and the stringified [`Ident`](/api/interfaces/yarnpkg_core.ident.html) identifying the generator package (`process.argv[2]`).

You're free to do whatever you want inside the temporary directory, but, at the end of the execution, Yarn will expect a `build` directory to have been created inside it that will then be compressed into an archive and stored within the cache.

Yarn injects the `execEnv` global variable inside the script. It's an `object` that contains various useful details about the execution context. We also provide type definitions through the [`ExecEnv`](/api/interfaces/plugin_exec.execenv.html) interface from `@yarnpkg/plugin-exec`.

| Property        | Type     | Description                                                                                   |
| --------------- | -------- | --------------------------------------------------------------------------------------------- |
| `tempDir`       | `string` | The absolute path of the temporary directory where the script runs. Equal to `process.cwd()`. |
| `locator`       | `string` | The stringified `Locator` identifying the generator package.                                  |
| `generatorPath` | `string` | The absolute path of the generator file. Equal to `process.argv[1]`.                          |

