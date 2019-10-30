# `@yarnpkg/plugin-exec`

This plugin will instruct Yarn to execute the specified script and use its output as package content.

The script will be invoked with one parameter which is a temporary directory. You're free to do whatever you want inside, but at the end of the execution Yarn will expect a `build` directory to have been created inside it that will then be compressed into an archive and stored within the cache.

Busting the cache is currently unsupported - you'll need to manually remove the relevant archives from your cache each time you want to update the content of the package. Help welcome!

## Install

```
yarn plugin import @yarnpkg/plugin-exec
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
const {mkdirSync, writeFileSync} = require(`child_process`);
const generatorPath = process.argv[2];

mkdirSync(`${generatorPath}/build`);

writeFileSync(`${generatorPath}/build/package.json`, JSON.stringify({
  name: `pkg`,
  version: `1.0.0`,
}));

writeFileSync(`${generatorPath}/build/index.js`, `module.exports = ${Date.now()};\n`);
```
