---
category: features
path: /features/protocols
title: "Protocols"
---

The following protocols are supported in dependencies range. We recommend you to only use semver ranges on published packages as they are the only common brick that share the same semantics accross all package managers, but you're free to do as you please based on your needs.

| Name | Example | Description |
| --- | --- | --- |
| Semver | `^1.2.3` | Resolves from the default registry |
| Tag | `latest` | Resolves from the default registry |
| Npm alias | `npm:name@...` | Resolves from the npm registry |
| Github (public) | `github:foo/bar` | Downloads a **public** package from Github |
| File | `file:./my-package` | Copies the location into the cache |
| Link | `link:./my-folder` | Creates a link to the `./my-folder` folder (ignore dependencies) |
| Portal | `portal:./my-folder` | Creates a link to the `./my-folder` folder (follow dependencies) |

## What's the difference between `link:` and `portal:`?

The `link:` protocol is meant to open links to any folder - for example you can use it to "map" a folder such as `src` to a clearer name that you can then use within your require calls (such as `my-app`). Because such destination folders typically don't contain `package.json`, the `link:` protocol doesn't use them at all. It can cause issues when you want to link to a different *package* on the disk (similar to what `yarn link` does), because then the transitive dependencies aren't resolved.

In order to solve this use case, we designed the `portal:` protocol which opens a portal to a package located on your disk. Because portals know that they only target packages, they're able to properly resolve transitive dependencies. And thanks to PnP, they even work as you would expect with peer dependencies!
