<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546">
  </a>
</p>

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

<p align="center">
  <a href="https://dev.azure.com/yarnpkg/berry/_build"><img alt="Azure Pipelines status" src="https://dev.azure.com/yarnpkg/berry/_apis/build/status/yarnpkg.berry"></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://img.shields.io/discord/226791405589233664.svg"></a>
  <img alt="Stable Release" src="https://img.shields.io/github/release/yarnpkg/yarn.svg?style=flat">
  <img alt="Prerelease" src="https://img.shields.io/github/release-pre/yarnpkg/yarn.svg?style=flat">
</p>

---

Yarn is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Yarn supports plugins; adding a plugin is as simple as adding it into your repository
- Yarn supports Node by default but isn't limited to it - plugins can add support for other languages
- Yarn supports [workspaces]() natively, and its CLI takes advantage of that
- Yarn uses a portable shell to execute package scripts, guaranteeing they work the same way on Windows and Linux
- Yarn is first and foremost a Node API that can be used programmatically (via [berry-core](packages/berry-core))
- Yarn is written in TypeScript, and fully typechecked

## Install

Because this repository is about the modern but experimental version of Yarn (aka Yarn v2), the install process is slightly different for the time being.

- Open one of your project
- First run `yarn policies set-version nightly` - to be sure that the next command will work
- Then run `yarn policies set-version berry` - this will fetch the v2 bundle
- And voilà! Just run any command, such as `yarn config -v` - they will use the v2
- To revert, just remove the local change to your `.yarnrc` file

## Documentation

The documentation is being reworked to contain an updated content and a refreshed design, and the most up-to-date version can be found on the repository GitHub pages: [yarnpkg.github.io/berry](http://yarnpkg.github.io/berry/)

## Generic packages

The following packages are generic and can be used in a variety of purposes (including to implement other package managers, but not only):

- [berry-core](packages/berry-core) allows any application to manipulate a project programmatically.
- [berry-json-proxy](packages/berry-json-proxy) allows to temporarily convert any POD object to an immutable object.
- [berry-libzip](packages/berry-libzip) contains zlib+libzip bindings compiled to WebAssembly.
- [berry-parsers](packages/berry-parsers) can be used to parse [Syml]() and the language used by [berry-shell](packages/berry-shell).
- [berry-pnp](packages/berry-pnp) can be used to generate [Plug'n'Play-compatible]() hooks.
- [berry-shell](packages/berry-shell) is a portable bash-like shell interpreter.
- [berry-ui](packages/berry-ui) is a React renderer targeting terminals.
- [berry-zipfs](packages/berry-zipfs) is a `fs` implementation that can read files from zip archives.

## Yarn plugins

The following packages are plugins for Berry and can be installed through `berry add plugin <plugin-name>`. Note that some of them are typically already shipped with the regular Yarn bundles. Such plugins are marked with a star (★).

- [plugin-constraints](packages/plugin-constraints) adds support for `yarn constraints check` and `yarn constraints fix`.
- [plugin-essentials★](packages/plugin-essentials) adds various commands deemed necessary for a package manager (add, remove, ...).
- [plugin-file★](packages/plugin-file) adds support for using `file:` references as dependencies.
- [plugin-github★](packages/plugin-github) adds support for using Github references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [plugin-http★](packages/plugin-http) adds support for using straight URL references as dependencies (tgz archives only).
- [plugin-hub](packages/plugin-hub) contains a UI designed to efficiently manage large-scale projects with multiple workspaces.
- [plugin-init★](packages/plugin-init) adds support for the `yarn init` command.
- [plugin-link★](packages/plugin-link) adds support for using `link:` and `portal:` references as dependencies.
- [plugin-npm★](packages/plugin-npm) adds support for using [semver ranges]() as dependencies, resolving them to an NPM-like registry.
- [plugin-pnp★](packages/plugin-pnp) adds support for installing Javascript dependencies through the [Plug'n'Play]() specification.

To create your own plugin, please refer to the [documentation]().

## Yarn packages

The following packages are meant to be used by Yarn itself, and probably won't be useful to other applications:

- [berry-builder](packages/berry-builder) contains a CLI tool to package berry and its plugins.
- [berry-cli](packages/berry-cli) is a CLI entry point built on top of [berry-core](packages/berry-core).

## Build your own bundle

Clone this repository, then run the following commands:

```
$> yarn build:cli
```

Note that no other command is needed! Since our dependencies are checked-in within the repository (within the [`.yarn/cache`](.yarn/cache) directory), you don't need to run any install. Everything just works right after cloning the project, and is guaranteed to continue to work ten years from now 🙂
