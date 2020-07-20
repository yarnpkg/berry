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

### `exec:`

This protocol is experimental, and only available after installing an optional plugin.

Its documentation and usage can be found on GitHub: [yarnpkg/berry/blob/master/packages/plugin-exec/README.md](https://github.com/yarnpkg/berry/blob/master/packages/plugin-exec/README.md).

## Frequently Asked Questions

### Can I install a workspace of a project when using the `git:` protocol?

Yes! Yarn supports workspaces even through git dependencies, using the following syntax:

```json
{
  "dependencies": {
    "my-pkg": "org/app#workspace=my-pkg"
  }
}
```

You can even combine it with the branch selectors:

```json
{
  "dependencies": {
    "my-pkg": "org/app#head=next&workspace=my-pkg"
  }
}
```

> **Note:** For this workflow to work, make sure that each individual workspaces can be built just by running `yarn install && yarn pack` into each individual workspace. In particular, avoid third-party release scripts unless they use `yarn pack` under the hood.

### Why can't I add dependencies through the `patch:` protocol?

A Yarn install is split across multiple steps (described [here](/advanced/architecture#install-architecture)). Most importantly, we first fully resolve the dependency tree, and only then do we download the packages from their remote sources. Since patches occur during this second step, by the time we inject the new dependencies it's already too late as the dependency tree has already been frozen.

In order to add dependencies to a package, either fork it (and reference it through the Git protocol, for example), or use the [`packageExtensions`](/configuration/yarnrc#packageExtensions) mechanism which is specifically made to add new runtime dependencies to packages.


### Why is the `link:` protocol recommended over aliases for path mapping?

Many tools support a feature generally known as "aliases", which allows you to map a specific directory to a package name. This pattern allows you to use regular package imports (`my-app/Toolbar`) instead of potentially complex relative paths (`../../../Toolbar`). It sounds awesome! So why do we recommend against this practice?

As we said, many tools support this feature. But the trick is that their implementations and configurations are all subtly different. Depending on the tool, it will be called `moduleNameMapper`, `resolve.alias`, `paths`, or even `module.name_mapper`. Depending on the tool it'll be a regex, a domain-specific language, or just a package name. All those differences make it difficult to keep the configurations synchronized, and likely that a mistake will creep in. Even worse, it'll lock you out of tools that don't support aliases, since they won't know how to deal with these paths they know nothing about.

Enter the `link:` protocol! Through it, you directly instruct the package manager to install a resolution from the given name to the given path. Since the package manager's knowledge base is used by every package in your project, adding a link dependency is enough to make all your tooling aware of this new connection. No need for further configuration 💫

```json
{
  "dependencies": {
    "src": "link:./src"
  }
}
```

> **Tip:** Yarn 2 implements support for self-references, making the `link:` protocol unneeded in most cases. Any file that's part of a package will always be able to import any file from its own package using the package name - even the top-level project! Just add a `"name": "app"` field into your top-level package.json, and you'll be able to use `import 'app/Toolbar'` without further ado.

> **Note:** You may be tempted t alias a scope without giving an explicit name (ie `"@app": "link:./src"`). Don't. This pattern is invalid and won't work. The reason for this is that package identifiers have a required package name, and an optional scope name. As a result, a scope without package name is a syntax error. Prefer doing `"app": "link:./src"`, which will still allow you to use subdirectories if needed (ie `import 'app/toolbar/Icon'`).

> **Note:** By reading this FAQ entry, you might think that we recommend against using aliases altogether. This isn't entirely correct. While using aliases *for directory mapping* is a practice we advise against, they have their usefulness in other contexts. For example, using an alias to map the `fs` module into a local mock is perfectly fine.

### What's the difference between `link:` and `portal:`?

The `link:` protocol is meant to link a package name to a folder on the disk - any folder. For example, one perfect use case for the `link:` protocol is to map your `src` folder to a clearer name that you can then use from your Node applications without having to use relative paths (for example you could link `my-app` to `link:./src` so that you can call `require('my-app')` from any file within your application).

Because such destination folders typically don't contain `package.json`, the `link:` protocol doesn't even try to read them. It can cause problems when you want to link an identifier to a different *package* on the disk (similar to what `yarn link` does) because then the transitive dependencies aren't resolved.

In order to solve this use case, the new `portal:` protocol available in the v2 opens a portal to any package located on your disk. Because portals are meant to only target packages they can leverage the information from the `package.json` files listed within their targets to properly resolve transitive dependencies.
