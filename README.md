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
- Yarn is first and foremost a Node API that can be used programmatically (via [berry-core](packages/berry-core))
- Yarn is written in TypeScript, and fully typechecked

## Install

Consult the [dedicated page](https://yarnpkg.github.io/berry/getting-started/install) for more details.

## Documentation

The documentation is being reworked to contain an updated content and a refreshed design, and the most up-to-date version can be found on the repository GitHub pages: [yarnpkg.github.io/berry](http://yarnpkg.github.io/berry/)

## Generic packages

The following packages are generic and can be used in a variety of purposes (including to implement other package managers, but not only):

- [@berry/core](packages/berry-core) allows any application to manipulate a project programmatically.
- [@berry/fslib](packages/berry-fslib) is a set of tools to efficiently abstract filesystem accesses.
- [@berry/json-proxy](packages/berry-json-proxy) allows to temporarily convert any POD object to an immutable object.
- [@berry/libzip](packages/berry-libzip) contains zlib+libzip bindings compiled to WebAssembly.
- [@berry/parsers](packages/berry-parsers) can be used to parse [Syml]() and the language used by [berry-shell](packages/berry-shell).
- [@berry/pnp](packages/berry-pnp) can be used to generate [Plug'n'Play](https://yarnpkg.github.io/berry/features/pnp)-compatible hooks.
- [@berry/pnpify](packages/berry-pnpify) is a CLI tool to transparently add PnP support to various tools.
- [@berry/shell](packages/berry-shell) is a portable bash-like shell interpreter.

## Yarn plugins

The following packages are plugins for Berry and can be installed through `yarn plugin import <plugin-name>`. Note that some of them are typically already shipped with the regular Yarn bundles. Such plugins are marked with a star (★).

- [plugin-constraints★](packages/plugin-constraints) adds support for `yarn constraints check` and `yarn constraints fix`.
- [plugin-dlx★](packages/plugin-dlx) adds support for the [`yarn dlx`](https://yarnpkg.github.io/berry/cli/dlx) command.
- [plugin-essentials★](packages/plugin-essentials) adds various commands deemed necessary for a package manager (add, remove, ...).
- [plugin-exec](packages/plugin-exec) adds support for using `exec:` references as dependencies.
- [plugin-file★](packages/plugin-file) adds support for using `file:` references as dependencies.
- [plugin-github★](packages/plugin-github) adds support for using Github references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [plugin-http★](packages/plugin-http) adds support for using straight URL references as dependencies (tgz archives only).
- [plugin-init★](packages/plugin-init) adds support for the [`yarn init`](https://yarnpkg.github.io/berry/cli/init) command.
- [plugin-link★](packages/plugin-link) adds support for using `link:` and `portal:` references as dependencies.
- [plugin-npm★](packages/plugin-npm) adds support for using [semver ranges]() as dependencies, resolving them to an NPM-like registry.
- [plugin-npm-cli★](packages/plugin-npm-cli) adds support for the NPM-specific commands (`yarn npm login`, [`yarn npm publish`](https://yarnpkg.github.io/berry/cli/npm/publish), ...).
- [plugin-pack★](packages/plugin-pack) adds support for the [`yarn pack`](https://yarnpkg.github.io/berry/cli/pack) command.
- [plugin-stage](packages/plugin-pack) adds support for the [`yarn stage`](https://yarnpkg.github.io/berry/cli/stage) command.
- [plugin-pnp★](packages/plugin-pnp) adds support for installing Javascript dependencies through the [Plug'n'Play](https://yarnpkg.github.io/berry/features/pnp) specification.
- [plugin-typescript★](packages/plugin-typescript) improves the user experience when working with TypeScript.
- [plugin-workspace-tools](packages/plugin-workspace-tools) adds support for the [`yarn workspaces foreach`](https://yarnpkg.github.io/berry/cli/workspaces/foreach) command.

To create your own plugin, please refer to the [documentation](https://yarnpkg.github.io/berry/features/plugins).

## Yarn packages

The following packages are meant to be used by Yarn itself, and probably won't be useful to other applications:

- [@berry/builder](packages/berry-builder) contains a CLI tool to package berry and its plugins.
- [@berry/cli](packages/berry-cli) is a CLI entry point built on top of [@berry/core](packages/berry-core).

## Build your own bundle

Clone this repository, then run the following commands:

```
$> yarn build:cli
```

**How it works**

After building the CLI your global `yarn` will immediately start to reflect your local changes. This is because Yarn will pick up the `yarnPath` settings in this repository's `.yarnrc.yml`, which is configured to use the newly built CLI if available.

**Works out of the box!**

Note that no other command is needed! Given that our dependencies are checked-in within the repository (within the [`.yarn/cache`](.yarn/cache) directory), you don't even need to run `yarn install`. Everything just works right after cloning the project, and is guaranteed to continue to work ten years from now 🙂
