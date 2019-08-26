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
  <img alt="Stable Release" src="https://img.shields.io/github/release/yarnpkg/yarn.svg?style=flat">
  <img alt="Prerelease" src="https://img.shields.io/github/release-pre/yarnpkg/yarn.svg?style=flat">
</p>

---

Yarn is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Yarn supports plugins; adding a plugin is as simple as adding it into your repository
- Yarn supports Node by default but isn't limited to it - plugins can add support for other languages
- Yarn supports [workspaces](https://yarnpkg.github.io/berry/features/workspaces) natively, and its CLI takes advantage of that
- Yarn uses a portable shell to execute package scripts, guaranteeing they work the same way on Windows and Linux
- Yarn is first and foremost a Node API that can be used programmatically (via [@yarnpkg/core](packages/yarnpkg-core))
- Yarn is written in TypeScript, and fully typechecked

## Install

Consult the [dedicated page](https://yarnpkg.github.io/berry/getting-started/install) for more details.

## Documentation

The documentation is being reworked to contain an updated content and a refreshed design, and the most up-to-date version can be found on the repository GitHub pages: [yarnpkg.github.io/berry](http://yarnpkg.github.io/berry/)

## Current status

On top of our classic integration tests, we also run Yarn every day against the latest versions of the toolchains used by our community - just in case, really. Everything should be green!

| Toolchain | E2E Tests | Tooling | E2E Tests |
| --- | --- | --- | --- |
| [Create-React-App](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-cra-workflow.yml) | [![](https://github.com/yarnpkg/berry/workflows/E2E%20CRA/badge.svg)]() | [ESLint](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-eslint-workflow.yml) | [![](https://github.com/yarnpkg/berry/workflows/E2E%20ESLint/badge.svg)]() |
| [Gatsby](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-gatsby-workflow.yml) | [![](https://github.com/yarnpkg/berry/workflows/E2E%20Gatsby/badge.svg)]() | [Prettier](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-prettier-workflow.yml) | [![](https://github.com/yarnpkg/berry/workflows/E2E%20Prettier/badge.svg)]() |
| | | [Jest](https://github.com/yarnpkg/berry/blob/master/.github/workflows/e2e-jest-workflow.yml) | [![](https://github.com/yarnpkg/berry/workflows/E2E%20Jest/badge.svg)]() |

## Build your own bundle

Clone this repository, then run the following commands:

```bash
yarn build:cli
```

**How it works**

After building the CLI your global `yarn` will immediately start to reflect your local changes. This is because Yarn will pick up the `yarnPath` settings in this repository's `.yarnrc.yml`, which is configured to use the newly built CLI if available.

**Works out of the box!**

Note that no other command is needed! Given that our dependencies are checked-in within the repository (within the [`.yarn/cache`](.yarn/cache) directory), you don't even need to run `yarn install`. Everything just works right after cloning the project, and is guaranteed to continue to work ten years from now 🙂

## Yarn plugins

### Default plugins

Those plugins typically come bundled with Yarn. You don't need to do anything special to use them.

- [★ plugin-constraints](packages/plugin-constraints) adds support for `yarn constraints check` and `yarn constraints fix`.
- [★ plugin-dlx](packages/plugin-dlx) adds support for the [`yarn dlx`](https://yarnpkg.github.io/berry/cli/dlx) command.
- [★ plugin-essentials](packages/plugin-essentials) adds various commands deemed necessary for a package manager (add, remove, ...).
- [★ plugin-file](packages/plugin-file) adds support for using the `file:` protocol within your dependencies.
- [★ plugin-github](packages/plugin-github) adds support for using Github references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [★ plugin-http](packages/plugin-http) adds support for using straight URL references as dependencies (tgz archives only).
- [★ plugin-init](packages/plugin-init) adds support for the [`yarn init`](https://yarnpkg.github.io/berry/cli/init) command.
- [★ plugin-link](packages/plugin-link) adds support for using `link:` and `portal:` references as dependencies.
- [★ plugin-npm](packages/plugin-npm) adds support for using [semver ranges](https://semver.org) as dependencies, resolving them to an NPM-like registry.
- [★ plugin-npm-cli](packages/plugin-npm-cli) adds support for the NPM-specific commands ([`yarn npm login`](https://yarnpkg.github.io/berry/cli/npm/login), [`yarn npm publish`](https://yarnpkg.github.io/berry/cli/npm/publish), ...).
- [★ plugin-pack](packages/plugin-pack) adds support for the [`yarn pack`](https://yarnpkg.github.io/berry/cli/pack) command.
- [★ plugin-pnp](packages/plugin-pnp) adds support for installing Javascript dependencies through the [Plug'n'Play](https://yarnpkg.github.io/berry/features/pnp) specification.

### Contrib plugins

Although developed on the same repository as Yarn itself, those plugins are optionals and need to be explicitly installed through `yarn plugin import @yarnpkg/<plugin-name>`.

- [☆ plugin-exec](packages/plugin-exec) adds support for using the `exec:` protocol within your dependencies.
- [☆ plugin-stage](packages/plugin-pack) adds support for the [`yarn stage`](https://yarnpkg.github.io/berry/cli/stage) command.
- [☆ plugin-typescript](packages/plugin-typescript) improves the user experience when working with TypeScript.
- [☆ plugin-workspace-tools](packages/plugin-workspace-tools) adds support for the [`yarn workspaces foreach`](https://yarnpkg.github.io/berry/cli/workspaces/foreach) command.

### Third-party plugins

Plugins can be developed by third-party entities. To use them within your applications, just specify the full plugin URL when calling [`yarn plugin import`](https://yarnpkg.github.io/berry/cli/plugin/import). Note that plugins aren't fetched from the npm registry at this time - they must be distributed as a single JavaScript file.

### Creating a new plugin

To create your own plugin, please refer to the [documentation](https://yarnpkg.github.io/berry/features/plugins).

## Generic packages

The following packages are generic and can be used in a variety of purposes (including to implement other package managers, but not only):

- [@yarnpkg/core](packages/yarnpkg-core) allows any application to manipulate a project programmatically.
- [@yarnpkg/fslib](packages/yarnpkg-fslib) is a set of tools to abstract the filesystem through type-safe primitives.
- [@yarnpkg/json-proxy](packages/yarnpkg-json-proxy) allows to temporarily convert any POD object to an immutable object.
- [@yarnpkg/libzip](packages/yarnpkg-libzip) contains zlib+libzip bindings compiled to WebAssembly.
- [@yarnpkg/parsers](packages/yarnpkg-parsers) can be used to parse the language used by [@yarnpkg/shell](packages/yarnpkg-shell).
- [@yarnpkg/pnp](packages/yarnpkg-pnp) can be used to generate [Plug'n'Play](https://yarnpkg.github.io/berry/features/pnp)-compatible hooks.
- [@yarnpkg/pnpify](packages/yarnpkg-pnpify) is a CLI tool to transparently add PnP support to various tools.
- [@yarnpkg/shell](packages/yarnpkg-shell) is a portable bash-like shell interpreter.

## Yarn packages

The following packages are meant to be used by Yarn itself, and probably won't be useful to other applications:

- [@yarnpkg/builder](packages/yarnpkg-builder) contains a CLI tool to package berry and its plugins.
- [@yarnpkg/cli](packages/yarnpkg-cli) is a CLI entry point built on top of [@yarnpkg/core](packages/yarnpkg-core).
