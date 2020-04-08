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
const {buildDir} = execEnv;

fs.writeFileSync(path.join(buildDir, `package.json`), JSON.stringify({
  name: `pkg`,
  version: `1.0.0`,
}));

fs.writeFileSync(path.join(buildDir, `index.js`), `module.exports = ${Date.now()};\n`);
```

## Documentation

The script will be invoked inside a temporary directory with two parameters: the generator path (`process.argv[1]`; Warning: it's not the `generatorPath` you expect, don't use it) and the stringified [`Ident`](/api/interfaces/yarnpkg_core.ident.html) identifying the generator package (`process.argv[2]`).

The content of the generator file is written to a file inside a temporary directory. That file is then invoked, so `require` doesn't work as expected. That's why we expose all of the built-in modules as global variables (`'module'` is exposed as `Module`)). If you want to bundle your own dependencies, you have to use a module bundler like Webpack or Rollup.

Yarn injects the `execEnv` global variable inside the script. It's an `object` that contains various useful details about the execution context. We also provide type definitions through the [`ExecEnv`](/api/interfaces/plugin_exec.execenv.html) interface from `@yarnpkg/plugin-exec`.

You're free to do whatever you want inside `execEnv.tempDir`, but, at the end of the execution, Yarn will expect `execEnv.buildDir` to contain the files that will then be compressed into an archive and stored within the cache.

| Property   | Type     | Description                                                                                                                                                     |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tempDir`  | `string` | The absolute path of the empty temporary directory. It is created before the script is invoked.                                                                 |
| `buildDir` | `string` | The absolute path of the empty build directory that will be compressed into an archive and stored within the cache. It is created before the script is invoked. |
| `locator`  | `string` | The stringified `Locator` identifying the generator package.                                                                                                    |

