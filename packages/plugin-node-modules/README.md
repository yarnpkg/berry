# `@yarnpkg/plugin-node-modules`

This plugin adds support for installing packages through a `node_modules` folder.

## Install

This plugin is included by default in Yarn 2, but is still considered experimental. For this reason, you must enable it manually by adding the following to your `.yarnrc` file:

```yml
nodeLinker: node-modules
```

## Word of caution

While they are supported by virtually every tool, installs using the `node_modules` strategy have various fundamental issues that the default Plug'n'Play installations don't suffer from (for more details, check out our [documentation](https://next.yarnpkg.com/features/pnp)). Carefully consider the pros and cons before enabling this plugin.

## Known issues

- A same package / reference combination present multiple times within the same `node_modules` dependency tree will have issues calling `yarn run` from within its postinstall scripts. This is because this plugin is able to extract the package locator from the current cwd, but since a same locator may be found in multiple places it's not possible to convert it back from the locator to its location on the disk.
