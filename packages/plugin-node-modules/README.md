# `@yarnpkg/plugin-http`

This plugin adds support for installing packages through a `node_modules` folder.

## Install

This plugin is included by default in Yarn 2, but is considered both experimental and **deprecated**. For this reason, you must enable it manually by adding the following to your `.yarnrc` file:

```yml
nodeLinker: node-modules
```

## Word of caution

The `node_modules` install strategy is incredibly awkward to implement in a sound way. In particular, because a single package may have multiple locations on the disk, it goes directly against the most obvious assumptions that any package manager would typically follow: multiple instances of a single package combination being installed exactly once per project.

For this reason we fully expect this plugin to suffer from various bugs and edge cases, especially when it comes to build scripts (as a result, adding `enableScripts: false` to your settings may somewhat improve the stability of the generated tree). **We do not recommend enabling this plugin**, and the only reason you should consider it at all is if a project you use refuse for some reason to support Plug'n'Play.

Additionally, and regardless of bugs, the `node_modules` installs are heavy, slow, unreliable, and I/O-bound. Should you use them, your experience will be much worse than if you were using the recommended PnP installs where all those problems and more have been fixed.

To reiterate one last time for good measure: support for installs using the `node_modules` algorithm will be sparse at best. We are working on improving Plug'n'Play installs, not fixing the `node_modules` ones. Our resources are limited and we don't use `node_modules` installs ourselves, so it's unlikely fixing a bug here will be a priority. If something bothers you, the best is to send a PR to help fix it.

To quote the repository [license](/LICENSE.md):

> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY [...] DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE

With that in mind, good luck. Here be dragons.

## Known issues

Keeping in mind the section above, here are some of the problems we're aware of but won't be fixed immediatly. For real, use the PnP linker.

- A same package / reference combination present multiple times within the same `node_modules` dependency tree will have issues calling `yarn run` from within its postinstall scripts. This is because this plugin is able to extract the package locator from the current cwd, but since a single locator may be in multiple places it then loses this information.
