# `@yarnpkg/plugin-node-modules`

This plugin adds support for installing packages through a `node_modules` folder.

## Install

This plugin is included by default in Yarn 2, but is still considered experimental. For this reason, you must enable it manually by adding the following to your `.yarnrc.yml` file:

```yml
nodeLinker: node-modules
```

## Word of caution

While they are supported by virtually every tool, installs using the `node_modules` strategy have various fundamental issues that the default Plug'n'Play installations don't suffer from (for more details, check out our [documentation](https://yarnpkg.com/features/pnp)). Carefully consider the pros and cons before enabling this plugin.
