---
category: protocols
slug: /protocol/exec
title: "Exec Protocol"
description: How exec dependencies work in Yarn.
---

The `exec:` protocol executes a Node.js script inside a temporary directory at fetch-time with a preconfigured runtime environment. This script is then expected to populate a special directory defined in the environment, and exit once the generation has finished.

```
yarn add my-pkg@exec:./package-builder.js
```

## Why would you want that

Typical Yarn fetchers download packages from the internet - this works fine if the project you want to use got packaged beforehand, but fails short as soon as you need to bundle it yourself. Yarn's builtin mechanism allows you to run the `prepare` script on compatible git repositories and use the result as final package, but even that isn't always enough - you may need to clone a specific branch, go into a specific directory, run a specific build script ... all things that makes it hard for us to support every single use case.

The `exec:` protocol represents a way to define yourself how the specified package should be fetched. In a sense, it can be seen as a more high-level version of the [Fetcher API](/advanced/lexicon#fetcher) that Yarn provides.

## Generator scripts & `require`

Because the generator will be called in a very special context (before any package has been installed on the disk), it won't be able to call the `require` function (not even with relative paths). Should you need very complex generators, just bundle them up beforehand in a single script using tools such as Webpack or Rollup.

Because of this restriction, and because generators will pretty much always need to use the Node builtin modules, those are made available in the global scope - in a very similar way to what the Node REPL already does. As a result, no need to manually require the `fs` module: it's available through the global `fs` variable!

## Runtime environment

In order to let the script knows about the various predefined folders involved in the generation process, Yarn will inject a special `execEnv` global variable available to the script. This object's [interface](/api/plugin-exec/interface/ExecEnv) is defined as such:

| Property | Type | Description |
| --- | --- | --- |
| `tempDir` | `string` | Absolute path of an empty temporary directory that the script is free to use. Automatically created before the script is invoked. |
| `buildDir` | `string` | Absolute path of an empty directory where the script is expected to generate the package files. Automatically created before the script is invoked. |
| `locator` | `string` | Stringified [locator](/advanced/lexicon#locator) identifying the generator package. |

You're free to do whatever you want inside `execEnv.tempDir` but, at the end of the execution, Yarn will expect `execEnv.buildDir` to contain the files that can be compressed into an archive and stored within the cache.

## Examples

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
