---
category: features
path: /features/protocols
title: "Protocols"
---

The following protocols can be used by any dependency entry listed in the `dependencies` or `devDependencies` fields. While they work regardless of the context we strongly recommend you to only use semver ranges on published packages as they are the one common protocol whose semantic is clearly defined across all package managers.

| Name | Example | Description |
| --- | --- | --- |
| Semver | `^1.2.3` | Resolves from the default registry |
| Tag | `latest` | Resolves from the default registry |
| Npm alias | `npm:name@...` | Resolves from the npm registry |
| GitHub | `foo/bar` | Alias for the `github:` protocol |
| GitHub | `github:foo/bar` | Downloads a **public** package from GitHub |
| File | `file:./my-package` | Copies the target location into the cache |
| Link | `link:./my-folder` | Creates a link to the `./my-folder` folder (ignore dependencies) |
| Patch | `patch:left-pad@1.0.0#./my-patch.patch` | Creates a patched copy of the original package |
| Portal | `portal:./my-folder` | Creates a link to the `./my-folder` folder (follow dependencies) |

## Why can't I add dependencies through the `patch:` protocol?

A Yarn install is split across multiple steps (described [here](/advanced/architecture#install-architecture)). Most importantly, we first fully resolve the dependency tree, and only then do we download the packages from their remote sources. Since patches occur during this second step, by the time we inject the new dependencies it's already too late as the dependency tree has already been frozen.

In order to add dependencies to a package, either fork it (and reference it through the Git protocol, for example), or use the [`packageExtensions`](/configuration/yarnrc#packageExtensions) mechanism which is specifically made to add new runtime dependencies to packages.

## What's the difference between `link:` and `portal:`?

The `link:` protocol is meant to link a package name to a folder on the disk - any folder. For example one perfect use case for the `link:` protocol is to map your `src` folder to a clearer name that you can then use from your Node applications without having to use relative paths (for example you could link `my-app` to `link:./src` so that you can call `require('my-app')` from any file within your application).

Because such destination folders typically don't contain `package.json`, the `link:` protocol doesn't even try to read them. It can cause problems when you want to link an identifier to a different *package* on the disk (similar to what `yarn link` does), because then the transitive dependencies aren't resolved.

In order to solve this use case, the new `portal:` protocol available in the v2 opens a portal to any package located on your disk. Because portals are meant to only target packages they can leverage the information from the `package.json` files listed within their targets to properly resolve transitive dependencies.
