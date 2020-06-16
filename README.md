<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

<p align="center">
  <a href="https://github.com/yarnpkg/berry"><img alt="GitHub Actions status" src="https://github.com/yarnpkg/berry/workflows/Integration/badge.svg"></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://img.shields.io/discord/226791405589233664.svg"></a>
  <a href="https://www.npmjs.com/package/@yarnpkg/cli"><img alt="Latest CLI Release" src="https://img.shields.io/npm/v/@yarnpkg/cli/latest?label=npm"></a>
</p>

---

Yarn is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Yarn supports [plugins](https://yarnpkg.com/features/plugins); adding a plugin is as simple as adding it into your repository
- Yarn supports Node by default but isn't limited to it - plugins can add support for other languages
- Yarn supports [workspaces](https://yarnpkg.com/features/workspaces) natively, and its CLI takes advantage of that
- Yarn uses a bash-like [portable shell](https://github.com/yarnpkg/berry/tree/master/packages/yarnpkg-shell#yarnpkgshell) to execute package scripts, guaranteeing they work the same way on Windows, Linux, and macOS
- Yarn is first and foremost a [Node API](https://yarnpkg.com/api/) that can be used programmatically (via [@yarnpkg/core](packages/yarnpkg-core))
- Yarn is written in [TypeScript](https://www.typescriptlang.org/) and is fully type-checked

## Installation

Consult the [Installation Guide](https://yarnpkg.com/getting-started/install).

## Migration

Consult the [Migration Guide](https://yarnpkg.com/advanced/migration).

## Documentation

The documentation can be found at [yarnpkg.com](https://yarnpkg.com/).

## API

The API documentation can be found at [yarnpkg.com/api](https://yarnpkg.com/api).

## Current status

On top of our classic integration tests, we also run Yarn every day against the latest versions of the toolchains used by our community - just in case. Everything should be green!

<table>
<tr><th>Toolchains</th><th>Tooling</th></tr>
<tr><td valign="top">

[![](https://github.com/yarnpkg/berry/workflows/E2E%20NM%20Angular/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-nm-angular-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Angular%20over%20PnPify/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-pnpify-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20CRA/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-cra-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Gatsby/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-gatsby-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Next/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-next-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Vue-CLI/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-vue-cli-workflow.yml)<br/>
</td><td valign="top">

[![](https://github.com/yarnpkg/berry/workflows/E2E%20ESLint/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-eslint-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20FSEvents/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-fsevents-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Husky/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-husky-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Jest/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-jest-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Mocha/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-mocha-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20NYC/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-nyc-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Parcel/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-parcel-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Prettier/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-prettier-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Rollup/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-rollup-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20TypeScript/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-typescript-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/workflows/E2E%20Webpack/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-webpack-workflow.yml)<br/>
</td></tr>

</table>

## Contributing

Consult the [Contributing Guide](https://yarnpkg.com/advanced/contributing).

### Building your own bundle

Clone this repository, then run the following commands:

```bash
yarn build:cli
```

**How it works**

After building the CLI your global `yarn` will immediately start to reflect your local changes. This is because Yarn will pick up the [`yarnPath`](https://yarnpkg.com/configuration/yarnrc#yarnPath) settings in this repository's [`.yarnrc.yml`](https://yarnpkg.com/configuration/yarnrc), which is configured to use the newly built CLI if available.

**Works out of the box!**

Note that no other command is needed! Given that our dependencies are checked-in within the repository (within the [`.yarn/cache`](.yarn/cache) directory), you don't even need to run [`yarn install`](https://yarnpkg.com/cli/install). Everything just works right after cloning the project and is guaranteed to continue to work ten years from now 🙂

## Yarn plugins

### Default plugins

Those plugins typically come bundled with Yarn. You don't need to do anything special to use them.

- [★ plugin-compat](packages/plugin-compat) contains various built-in patches that will be applied to packages that aren't compatible with the Plug'n'Play resolution out-of-the-box.
- [★ plugin-dlx](packages/plugin-dlx) adds support for the [`yarn dlx`](https://yarnpkg.com/cli/dlx) command.
- [★ plugin-essentials](packages/plugin-essentials) adds various commands deemed necessary for a package manager (add, remove, ...).
- [★ plugin-file](packages/plugin-file) adds support for using the `file:` protocol within your dependencies.
- [★ plugin-git](packages/plugin-git) adds support for cloning packages from Git repositories.
- [★ plugin-github](packages/plugin-github) adds support for using GitHub references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [★ plugin-http](packages/plugin-http) adds support for using straight URL references as dependencies (tgz archives only).
- [★ plugin-init](packages/plugin-init) adds support for the [`yarn init`](https://yarnpkg.com/cli/init) command.
- [★ plugin-link](packages/plugin-link) adds support for using [`link:` and `portal:`](https://yarnpkg.com/features/protocols#whats-the-difference-between-link-and-portal) references as dependencies.
- [★ plugin-node-modules](packages/plugin-node-modules) adds support for installing packages through a `node_modules` folder.
- [★ plugin-npm](packages/plugin-npm) adds support for using [semver ranges](https://semver.org) as dependencies, resolving them to an NPM-like registry.
- [★ plugin-npm-cli](packages/plugin-npm-cli) adds support for the NPM-specific commands ([`yarn npm info`](https://yarnpkg.com/cli/npm/info), [`yarn npm login`](https://yarnpkg.com/cli/npm/login), [`yarn npm publish`](https://yarnpkg.com/cli/npm/publish), ...).
- [★ plugin-pack](packages/plugin-pack) adds support for the [`yarn pack`](https://yarnpkg.com/cli/pack) command.
- [★ plugin-patch](packages/plugin-patch) adds support for the `patch:` protocol.
- [★ plugin-pnp](packages/plugin-pnp) adds support for installing JavaScript dependencies through the [Plug'n'Play](https://yarnpkg.com/features/pnp) specification.

### Contrib plugins

Although developed on the same repository as Yarn itself, those plugins are optional and need to be explicitly installed through `yarn plugin import @yarnpkg/<plugin-name>`.

- [☆ plugin-constraints](packages/plugin-constraints) adds support for [constraints](https://yarnpkg.com/features/constraints) to Yarn.
- [☆ plugin-exec](packages/plugin-exec) adds support for using the [`exec:`](https://github.com/yarnpkg/berry/tree/master/packages/plugin-exec#documentation) protocol within your dependencies.
- [☆ plugin-interactive-tools](packages/plugin-interactive-tools) adds support for various interactive commands ([`yarn upgrade-interactive`](https://yarnpkg.com/cli/upgrade-interactive)).
- [☆ plugin-stage](packages/plugin-stage) adds support for the [`yarn stage`](https://yarnpkg.com/cli/stage) command.
- [☆ plugin-typescript](packages/plugin-typescript) improves the user experience when working with TypeScript.
- [☆ plugin-version](packages/plugin-version) adds support for the new [release workflow](https://yarnpkg.com/features/release-workflow).
- [☆ plugin-workspace-tools](packages/plugin-workspace-tools) adds support for the [`yarn workspaces foreach`](https://yarnpkg.com/cli/workspaces/foreach) command.

### Third-party plugins

Plugins can be developed by third-party entities. To use them within your applications, just specify the full plugin URL when calling [`yarn plugin import`](https://yarnpkg.com/cli/plugin/import). Note that plugins aren't fetched from the npm registry at this time - they must be distributed as a single JavaScript file.

### Creating a new plugin

To create your own plugin, please refer to the [documentation](https://yarnpkg.com/features/plugins).

## Generic packages

The following packages are generic and can be used in a variety of purposes (including to implement other package managers, but not only):

- [@yarnpkg/core](packages/yarnpkg-core) allows any application to manipulate a project programmatically.
- [@yarnpkg/fslib](packages/yarnpkg-fslib) is a set of tools to abstract the filesystem through type-safe primitives.
- [@yarnpkg/json-proxy](packages/yarnpkg-json-proxy) allows to temporarily convert any POD object to an immutable object.
- [@yarnpkg/libzip](packages/yarnpkg-libzip) contains zlib+libzip bindings compiled to WebAssembly.
- [@yarnpkg/parsers](packages/yarnpkg-parsers) can be used to parse the language used by [@yarnpkg/shell](packages/yarnpkg-shell).
- [@yarnpkg/pnp](packages/yarnpkg-pnp) can be used to generate [Plug'n'Play](https://yarnpkg.com/features/pnp)-compatible hooks.
- [@yarnpkg/pnpify](packages/yarnpkg-pnpify) is a CLI tool to transparently add PnP support to various tools.
- [@yarnpkg/shell](packages/yarnpkg-shell) is a portable bash-like shell interpreter.

## Yarn packages

The following packages are meant to be used by Yarn itself, and probably won't be useful to other applications:

- [@yarnpkg/builder](packages/yarnpkg-builder) contains a CLI tool to package berry and its plugins.
- [@yarnpkg/cli](packages/yarnpkg-cli) is a CLI entry point built on top of [@yarnpkg/core](packages/yarnpkg-core).
