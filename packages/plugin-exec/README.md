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
const {buildDir} = execEnv;

fs.writeFileSync(path.join(buildDir, `package.json`), JSON.stringify({
  name: `pkg`,
  version: `1.0.0`,
}));

fs.writeFileSync(path.join(buildDir, `index.js`), `module.exports = ${Date.now()};\n`);
```

## Rationale

Typical Yarn fetchers download packages from the internet - this works fine if the project you want to use got packaged beforehand, but fails short as soon as you need to bundle it yourself. Yarn's builtin mechanism allows you to run the `prepare` script on compatible git repositories and use the result as final package, but even that isn't always enough - you may need to clone a specific branch, go into a specific directory, run a specific build script ... all things that makes it hard for us to support every single use case.

The `exec:` protocol represents a way to define yourself how the specified package should be fetched. In a sense, it can be seen as a more high-level version of the [Fetcher API](/advanced/lexicon#fetcher) that Yarn provides.

## Documentation

The JavaScript file targeted by the `exec:` protocol will be invoked inside a temporary directory at fetch-time with a preconfigured runtime environment. The script is then expected to populate a special directory defined in the environment, and exit once the generation has finished.

### Generator scripts & `require`

Because the generator will be called in a very special context (before any package has been installed on the disk), it won't be able to call the `require` function (not even with relative paths). Should you need very complex generators, just bundle them up beforehand in a single script using tools such as Webpack or Rollup.

Because of this restriction, and because generators will pretty much always need to use the Node builtin modules, those are made available in the global scope - in a very similar way to what the Node REPL already does. As a result, no need to manually require the `fs` module: it's available through the global `fs` variable!

### Runtime environment

In order to let the script knows about the various predefined folders involved in the generation process, Yarn will inject a special `execEnv` global variable available to the script. This object's [interface](/api/interfaces/plugin_exec.execenv.html) is defined as such:

| Property   | Type     | Description                                                                                                                                                     |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tempDir`  | `string` | The absolute path of the empty temporary directory. It is created before the script is invoked.                                                                 |
| `buildDir` | `string` | The absolute path of the empty build directory that will be compressed into an archive and stored within the cache. It is created before the script is invoked. |
| `locator`  | `string` | The stringified `Locator` identifying the generator package.                                                                                                    |

You're free to do whatever you want inside `execEnv.tempDir` but, at the end of the execution, Yarn will expect `execEnv.buildDir` to contain the files that can be compressed into an archive and stored within the cache.

### Example

Generate an hello world package:

```ts
fs.writeFileSync(path.join(execEnv.buildDir, 'package.json'), JSON.stringify({
  name: 'hello-world',
  version: '1.0.0',
}));

fs.writeFileSync(path.join(execEnv.buildDir, 'index.js'), `
  module.exports = 'hello world!';
`);
```

Clone a monorepo and build a specific package:

```ts
const pathToRepo = path.join(execEnv.tempDir, 'repo');
const pathToArchive = path.join(execEnv.tempDir, 'archive.tgz');
const pathToSubpackage = path.join(pathToRepo, 'packages/foobar');

// Clone the repository
child_process.execFileSync(`git`, [`clone`, `git@github.com:foo/bar`, pathToRepo]);

// Install the dependencies
child_process.execFileSync(`yarn`, [`install`], {cwd: pathToRepo});

// Pack a specific workspace
child_process.execFileSync(`yarn`, [`pack`, `--out`, pathToArchive], {cwd: pathToSubpackage});

// Send the package content into the build directory
child_process.execFileSync(`tar`, [`-x`, `-z`, `--strip-components=1`, `-f`, pathToArchive, `-C`, execEnv.buildDir]);
```
