<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn" src="https://github.com/yarnpkg/assets/blob/master/yarn-kitten-full.png?raw=true" width="546"/>
  </a>
</p>

<p align="center">
  Fast, reliable, and secure dependency management.
</p>

<p align="center">
  <a href="https://github.com/yarnpkg/berry"><img alt="GitHub Actions status" src="https://github.com/yarnpkg/berry/workflows/Integration/badge.svg"/></a>
  <a href="https://discord.gg/yarnpkg"><img alt="Discord Chat" src="https://img.shields.io/discord/226791405589233664.svg"/></a>
  <a href="https://github.com/yarnpkg/berry"><img alt="Latest CLI Release" src="https://img.shields.io/npm/v/@yarnpkg/cli/latest?label=latest"/></a>
</p>

---

Yarn is a modern package manager split into various packages. Its novel architecture allows to do things currently impossible with existing solutions:

- Yarn supports [plugins](https://yarnpkg.com/features/extensibility); adding a plugin is as simple as adding it into your repository
- Yarn supports Node by default but isn't limited to it - plugins can add support for other languages
- Yarn supports [workspaces](https://yarnpkg.com/features/workspaces) natively, and its CLI takes advantage of that
- Yarn uses a bash-like [portable shell](https://github.com/yarnpkg/berry/tree/master/packages/yarnpkg-shell#yarnpkgshell) to make package scripts portable across Windows, Linux, and macOS
- Yarn is first and foremost a [Node API](https://yarnpkg.com/api/) that can be used programmatically (via [@yarnpkg/core](packages/yarnpkg-core))
- Yarn is written in [TypeScript](https://www.typescriptlang.org/) and is fully type-checked

## Our supports

### [Gold sponsors](https://opencollective.com/yarnpkg)

<table width="100%">
  <tr>
    <td>
      <a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github#gh-light-mode-only">
        <img src="https://assets.website-files.com/5de9972f49103c5df3964004/5f0c1146992a5e9e4fa553e6_logo.svg" width="140"/>
      </a>
      <a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github#gh-dark-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151548177-308f0a41-fb0e-4311-9969-4a2455b08686.svg" width="140"/>
      </a>
    </td>
    <td>
      <b>All your environment variables, in one place</b>. Stop struggling with scattered API keys, hacking together home-brewed tools, and avoiding access controls. Keep your team and servers in sync with <b><a href="https://www.doppler.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=yarn&utm_source=github">Doppler</a></b>.
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github#gh-light-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151547094-7aa4a5cb-07e4-4b8a-ab8f-0a15fd63ab7d.svg" width="140"/>
      </a>
      <a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github#gh-dark-mode-only">
        <img src="https://user-images.githubusercontent.com/1037931/151547899-3655e0d3-3bdb-4351-bd75-af2bebd3ce92.svg" width="140"/>
      </a>
    </td>
    <td>
      <b>Your app, enterprise-ready</b>. Start selling to enterprise customers with just a few lines of code. Add Single Sign-On (and more) in minutes instead of months with <b><a href="https://workos.com/?utm_campaign=github_repo&utm_medium=referral&utm_content=berry&utm_source=github">WorkOS</a></b>.
    </td>
  </tr>
</table>

### But also

<table width="100%">
  <tr>
    <td>
      <a href="https://www.datadoghq.com/">
        <img src="https://user-images.githubusercontent.com/1037931/86770706-62299e00-c051-11ea-931a-2831c894ab6a.png" width="140"/>
      </a>
    </td>
    <td>
      <b><a href="https://www.datadoghq.com/">Datadog</a></b> has been sponsoring the time of our lead maintainer for more than a year now. They also upgraded our account so that we can benefit from long-term telemetry (<a href="https://github.com/yarnpkg/berry/issues/1250">RFC</a>).
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://sysgears.com/">
        <img src="https://github.com/yarnpkg/berry/assets/1259926/c4d46d45-4f45-4b20-811e-d1f9d9e452dd" width="140"/>
      </a>
    </td>
    <td>
      <b><a href="https://sysgears.com/">SysGears</a></b> also sponsored time from very early in the 2.x development. In particular, their strong investment is the reason why Yarn 2 supports node_modules installs even better than it used to.
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.netlify.com/">
        <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/Netlify_logo.svg" width="140"/>
      </a>
    </td>
    <td>
      <b><a href="https://www.netlify.com/">Netlify</a></b> has been the historical provider for our website. Each time we got issues, they jumped to our help. Their live previews have been super helpful in our development process.
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.cloudflare.com/">
       <img src="https://user-images.githubusercontent.com/1037931/86770912-bc2a6380-c051-11ea-9f99-97161b2d7cf2.png" width="140"/>
      </a>
    </td>
    <td>
      <b><a href="https://www.cloudflare.com/">Cloudflare</a></b> has also been a historical partner. While we don't directly mirror the npm registry anymore, they still power our website to make its delivery as fast as possible.
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.algolia.com/">
       <img src="https://upload.wikimedia.org/wikipedia/commons/d/da/Algolia_logo.svg" width="140"/>
      </a>
    </td>
    <td>
      <b><a href="https://www.algolia.com/">Algolia</a></b> contributed a lot to our documentation over the years. They still power the search engine we use on both versions of the documentation.
    </td>
  </tr>
</table>

## Installation

Consult the [Installation Guide](https://yarnpkg.com/getting-started/install).

## Migration

Consult the [Migration Guide](https://yarnpkg.com/getting-started/migration).

## Documentation

The documentation can be found at [yarnpkg.com](https://yarnpkg.com/).

## API

The API documentation can be found at [yarnpkg.com/api](https://yarnpkg.com/api).

## Current status

On top of our classic integration tests, we also run Yarn every day against the latest versions of the toolchains used by our community - just in case. Everything should be green!

<table>
<tr><th>Toolchains</th><th>Tooling</th></tr>
<tr><td valign="top">

[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-nm-angular-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-nm-angular-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-pnp-angular-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-pnp-angular-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-cra-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-cra-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-create-vue-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-create-vue-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-gatsby-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-gatsby-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-gulp-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-gulp-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-next-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-next-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-svelte-kit-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-svelte-kit-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-vite-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-vite-workflow.yml)<br/>
</td><td valign="top">

[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-esbuild-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-esbuild-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-docusaurus-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-docusaurus-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-eslint-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-eslint-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-fsevents-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-fsevents-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-husky-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-husky-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-jest-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-jest-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-mocha-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-mocha-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-nyc-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-nyc-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-parcel-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-parcel-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-prettier-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-prettier-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-rollup-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-rollup-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-storybook-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-storybook-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-typescript-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-typescript-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-vitest-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-vitest-workflow.yml)<br/>
[![](https://github.com/yarnpkg/berry/actions/workflows/e2e-webpack-workflow.yml/badge.svg?event=schedule)](https://github.com/yarnpkg/berry/actions/workflows/e2e-webpack-workflow.yml)<br/>
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

- [plugin-compat](packages/plugin-compat) contains a few built-in patches applied to improve PnP support.
- [plugin-constraints](packages/plugin-constraints) adds support for [constraints](https://yarnpkg.com/features/constraints) to Yarn.
- [plugin-dlx](packages/plugin-dlx) adds support for the [`yarn dlx`](https://yarnpkg.com/cli/dlx) command.
- [plugin-essentials](packages/plugin-essentials) adds various commands deemed necessary for a package manager (add, remove, ...).
- [plugin-exec](packages/plugin-exec) adds support for using the [`exec:`](https://github.com/yarnpkg/berry/tree/master/packages/plugin-exec#documentation) protocol within your dependencies.
- [plugin-file](packages/plugin-file) adds support for using the `file:` protocol within your dependencies.
- [plugin-git](packages/plugin-git) adds support for cloning packages from Git repositories.
- [plugin-github](packages/plugin-github) adds support for using GitHub references as dependencies. [This plugin doesn't use git.](https://stackoverflow.com/a/13636954/880703)
- [plugin-http](packages/plugin-http) adds support for using straight URL references as dependencies (tgz archives only).
- [plugin-init](packages/plugin-init) adds support for the [`yarn init`](https://yarnpkg.com/cli/init) command.
- [plugin-interactive-tools](packages/plugin-interactive-tools) adds support for various interactive commands ([`yarn upgrade-interactive`](https://yarnpkg.com/cli/upgrade-interactive)).
- [plugin-link](packages/plugin-link) adds support for using [`link:`](https://yarnpkg.com/protocol/link) and [`portal:`](https://yarnpkg.com/protocol/portal) references as dependencies.
- [plugin-nm](packages/plugin-nm) adds support for installing packages through a `node_modules` folder.
- [plugin-npm](packages/plugin-npm) adds support for using [semver ranges](https://semver.org) dependencies, resolving them from an npm-like registry.
- [plugin-npm-cli](packages/plugin-npm-cli) adds support for npm-specific commands ([`yarn npm login`](https://yarnpkg.com/cli/npm/login), [`yarn npm publish`](https://yarnpkg.com/cli/npm/publish), ...).
- [plugin-pack](packages/plugin-pack) adds support for the [`yarn pack`](https://yarnpkg.com/cli/pack) command.
- [plugin-patch](packages/plugin-patch) adds support for the `patch:` protocol.
- [plugin-pnp](packages/plugin-pnp) adds support for installing JavaScript dependencies through the [Plug'n'Play](https://yarnpkg.com/features/pnp) specification.
- [plugin-stage](packages/plugin-stage) adds support for the [`yarn stage`](https://yarnpkg.com/cli/stage) command.
- [plugin-typescript](packages/plugin-typescript) improves the user experience when working with TypeScript.
- [plugin-version](packages/plugin-version) adds support for the new [release workflow](https://yarnpkg.com/features/release-workflow).
- [plugin-workspace-tools](packages/plugin-workspace-tools) adds support for the [`yarn workspaces foreach`](https://yarnpkg.com/cli/workspaces/foreach) command.

### Third-party plugins

Plugins can be developed by third-party entities. To use them within your applications, just specify the full plugin URL when calling [`yarn plugin import`](https://yarnpkg.com/cli/plugin/import). Note that plugins aren't fetched from the npm registry at this time - they must be distributed as a single JavaScript file.

### Creating a new plugin

To create your own plugin, please refer to the [documentation](https://yarnpkg.com/advanced/plugin-tutorial).

## Generic packages

The following packages are generic and can be used for a variety of purposes (including to implement other package managers, but not only):

- [@yarnpkg/core](packages/yarnpkg-core) allows any application to manipulate a project programmatically.
- [@yarnpkg/fslib](packages/yarnpkg-fslib) is a set of tools to abstract the filesystem through type-safe primitives.
- [@yarnpkg/libzip](packages/yarnpkg-libzip) contains zlib+libzip bindings compiled to WebAssembly.
- [@yarnpkg/nm](packages/yarnpkg-nm) contains the `node_modules` tree builder and hoister.
- [@yarnpkg/parsers](packages/yarnpkg-parsers) can be used to parse the language used by [@yarnpkg/shell](packages/yarnpkg-shell).
- [@yarnpkg/pnp](packages/yarnpkg-pnp) can be used to generate [Plug'n'Play](https://yarnpkg.com/features/pnp)-compatible hooks.
- [@yarnpkg/pnpify](packages/yarnpkg-pnpify) is a CLI tool to transparently add PnP support to various tools.
- [@yarnpkg/sdks](packages/yarnpkg-sdks) is a CLI tool to generate the [PnP Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks).
- [@yarnpkg/shell](packages/yarnpkg-shell) is a portable bash-like shell interpreter.

## Yarn packages

The following packages are meant to be used by Yarn itself, and probably won't be useful to other applications:

- [@yarnpkg/builder](packages/yarnpkg-builder) contains a CLI tool to package berry and its plugins.
- [@yarnpkg/cli](packages/yarnpkg-cli) is a CLI entry point built on top of [@yarnpkg/core](packages/yarnpkg-core).
