# `@yarnpkg/plugin-exec`

This plugin will add support to Yarn for the `exec:` protocol. This protocol is special in that it'll instruct Yarn to execute the specified Node script and use its output as package content (thus treating the script as a kind of package factory).

## Install

```
yarn plugin import exec
```

## Usage

**package.json**

```json
{
  "dependencies": {
    "pkg": "exec:./gen-pkg.js"
  }
}
```

**gen-pkg.js**

```js
const {mkdirSync, writeFileSync} = require(`fs`);
const generatorPath = process.argv[2];

mkdirSync(`${generatorPath}/build`);

writeFileSync(`${generatorPath}/build/package.json`, JSON.stringify({
  name: `pkg`,
  version: `1.0.0`,
}));

writeFileSync(`${generatorPath}/build/index.js`, `module.exports = ${Date.now()};\n`);
```

## Documentation

The script will be invoked with one parameter which is a temporary directory. You're free to do whatever you want inside, but at the end of the execution Yarn will expect a `build` directory to have been created inside it that will then be compressed into an archive and stored within the cache.

Busting the cache isn't currently supported - you'll need to manually remove the relevant archives from your cache each time you want to update the content of the package. Help welcome!
