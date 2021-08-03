# Changelog

## Sponsorship

Yarn now accepts sponsorships! Please give a look at our [OpenCollective](https://opencollective.com/yarnpkg) and [GitHub Sponsors](https://github.com/sponsors/yarnpkg) pages for more details.

## Master

**Note:** features in `master` can be tried out by running `yarn set version from sources` in your project (existing contrib plugins are updated automatically, while new contrib plugins can be added by running `yarn plugin import from sources <name>`).

## 3.0.0

### **Breaking Changes**

- Node 10 isn't supported anymore.
- Plugins can't access `yup` anymore (we migrated to [Typanion](https://github.com/arcanis/typanion) as part of [Clipanion v3](https://github.com/arcanis/clipanion)).
  - To upgrade `workspace-tools`, remove it from your `.yarnrc.yml`, upgrade, then import it back.
- The `enableImmutableInstalls` will now default to `true` on CI (we still recommend to explicitly use `--immutable` on the CLI).
  - You can re-allow mutations by adding `YARN_ENABLE_IMMUTABLE_INSTALLS=false` in your environment variables.
- The `initVersion` and `initLicense` configuration options have been removed. `initFields` should be used instead.
- Yarn will now generate `.pnp.cjs` files (instead of `.pnp.js`) when using PnP, regardless of what the `type` field inside the manifest is set to.
- The virtual folder (used to disambiguate peer dependencies) got renamed from `$$virtual` into `__virtual__`.
- The `-a` alias flag of `yarn workspaces foreach` got removed; use `-A,--all` instead, which is strictly the same.
- The old PnPify SDK folder (`.vscode/pnpify`) won't be cleaned up anymore.
- The `--skip-builds` flag from `yarn install` got renamed into `--mode=skip-build`.
- The `bstatePath` configuration option has been removed. The build state (`.yarn/build-state.yml`) has been moved into the install state (`.yarn/install-state.gz`)
- The cache files need to be regenerated. We had to change their timestamps in order to account for a flaw in the zip spec that was causing problems with some third-party tools.
- `@yarnpkg/pnpify` has been refactored into 3 packages:
  - `@yarnpkg/sdks` now contains the [Editor SDKs](https://yarnpkg.com/getting-started/editor-sdks)
  - `@yarnpkg/pnpify` now contains the [PnPify CLI compatibility tool that creates in-memory `node_modules`](https://yarnpkg.com/advanced/pnpify)
  - `@yarnpkg/nm` now contains the `node_modules` tree builder and hoister
- `@yarnpkg/plugin-node-modules` has been renamed to `@yarnpkg/plugin-nm`
- The `--clipanion=definitions` commands supported by our CLIs will now expose the definitions on the entry point (rather than on `.command`)

### API

- `structUtils.requirableIdent` got removed; use `structUtils.stringifyIdent` instead, which is strictly the same.
- `configuration.format` got removed; use `formatUtils.pretty` instead, which is strictly the same, but type-safe.
- `httpUtils.Options['json']` got removed; use `httpUtils.Options['jsonResponse']` instead, which is strictly the same.
- `PackageExtension['description']` got removed, use `formatUtils.json(packageExtension, formatUtils.Type.PACKAGE_EXTENSION)` instead, which is strictly the same.
- `Project.generateBuildStateFile` has been removed, the build state is now in `Project.storedBuildState`.
- `Project.tryWorkspaceByDescriptor` and `Project.getWorkspaceByDescriptor` now match on virtual descriptors.

### Installs

- Workspaces now get self-references even when under the `node-modules` linker (just like how it already worked with the `pnp` linker). This means that a workspace called `foo` can now safely assume that calls to `require('foo/package.json')` will always work, removing the need for [absolute aliases](https://nextjs.org/docs/advanced-features/module-path-aliases) in the majority of cases.

- The node-modules linker now does its best to support the `portal:` protocol. This support comes with two important limitations:
  - Projects that make use of such dependencies will have to be run with the `--preserve-symlinks` Node option if they wish to access their dependencies.
  - Because Yarn installs will never modify files outside of the project due to security reasons, sub-dependencies of packages with `portal:` must be hoisted outside of the portal. Failing that (for example if the portal package depends on something incompatible with the version hoisted via another package), the linker will produce an error and abandon the install.

- The node-modules linker can now utilize hardlinks. The new setting `nmMode: classic | hardlinks-local | hardlinks-global` specifies which `node_modules` strategy should be used:
  - `classic` - standard `node_modules` layout, without hardlinks
  - `hardlinks-local` - standard `node_modules` layout with hardlinks inside the project only
  - `hardlinks-global` - standard `node_modules` layout with hardlinks pointing to global content storage across all the projects using this option

### Bugfixes

- Yarn now has a proper [governance model](https://github.com/yarnpkg/berry/blob/master/GOVERNANCE.md).
- The `node-modules` linker will now ensure that the generated install layouts are terminal, by doing several rounds when needed.
- The `node-modules` linker will no longer print warnings about postinstall scripts when a workspace depends on another workspace listing install scripts.
- Peer dependencies depending on their own parent are now properly hoisted by the node-modules linker.
- Boolean values will be properly interpreted when specified inside the configuration file via the `${ENV_VAR}` syntax.
- Should any of `preinstall`, `install`, `postinstall` fail, the remaining scripts will be skipped.
- The `git:` protocol will now default to fetching `HEAD` (rather than the hardcoded `master`).
- The `SIGTERM` signal will now be propagated to child processes.
- The PnP linker now schedules packages to be rebuilt if their unplugged folder is removed
- `yarn config unset` will now correctly unset non-nested properties
- The TypeScript SDK now
- And a bunch of smaller fixes.

### Settings

- Various `initFields` edge cases have been fixed.
- The `preferAggregateCacheInfo` flag will now also aggregate cleanup reports.
- A new `enableMessageNames` flag can be set to `false` to exclude the `YNxxxx` from the output.

### Commands

- `yarn init` can now be run even from within existing projects (will create missing files).
- `yarn init` and `yarn set version` will set the [`packageManager`]() field.
- `yarn set version` now downloads binaries from the official Yarn website (rather than GitHub).
- `yarn set version from sources` will now upgrade the builtin plugins as well unless `--skip-plugins` is set.
- `yarn version apply` now supports a new `--prerelease` flag which replaces how prereleases were previously handled.
- `yarn run` should be significantly faster to boot on large projects.
- `yarn workspaces foreach --verbose` will now print when processes start and end, even if they don't have an output.
- `yarn workspaces foreach` now supports a `--from <glob>` flag, which when combined with `-R` will target workspaces reachable from the 'from' glob.
- `yarn patch-commit` can now be used as many times as you want on the same patch folder.
- `yarn patch-commit` now supports a new `-s,--save` flag which will save the patch instead of just printing it.
- `yarn up` now supports a new `-R,--recursive` flag which will upgrade the specified package, regardless where it is.
- `yarn config unset` is a new command that will remove a setting from the local configuration (or home if `-H` is set).
- `yarn exec` got support for running shell scripts using Yarn's portable shell.
- `yarn plugin import` can now install specific versions of the official plugins.
- `yarn plugin import` will now download plugins compatible with the current CLI by default.
- `yarn unlink` has been added which removes resolutions previously set by `yarn link`.

### Builtin Shell

- The shell now supports background jobs, with color-coded output.
- It now also supports redirections from file descriptors.

### Compatibility

- Running `yarn install` inside a Yarn v1 project will now automatically enable the `node-modules` linker. This should solve most of the problems people have had in their migrations. We still recommend to keep the default PnP for new projects, but the choice is yours.
- The patched filesystem now supports file URLs, `bigint`, and `fstat`.
- An official ESBuild resolver is now provided under the name `@yarnpkg/esbuild-plugin-pnp`. We use it to bundle Yarn itself!
- PnP projects can now use the Node [`exports` field](https://nodejs.org/api/packages.html#packages_package_entry_points) - regardless of the Node version.
- The PnP hook now supports the `node:` protocol (new in Node 16)
- The Prettier SDK does not use PnPify anymore since it was its only remaining use, and was fairly invasive; as a result, the Prettier plugins must be specified in Prettier's `plugins` configuration property.
- Zip terminal links can now be clicked from within VSCode
- Builtin patches that fail to apply will no longer cause an error (they'll emit a warning and the original sources will be used instead).
  - Remember that patches are a problem for our team too, and that we only do this because we don't have any other option available to us right now - if you wish to help, consider [upvoting](https://github.com/microsoft/TypeScript/pull/35206) the relevant pull request in the TypeScript repository or, if you work at Microsoft, perhaps mention to your TypeScript team next door that fixing this would benefit you.

### Miscellaneous

- Reporting for HTTP errors has been improved, which should help you investigate registry issues.

## 2.4.1

```
yarn set version 2.4.1
```

### Compatibility

- The release of TypeScript 4.2 couldn't be installed due to patch conflicts. This is now fixed. This version only includes a fix specific to 4.2, but future Yarn releases starting from 3.0 will be more tolerant of this kind of situation and won't cause such errors.

## 2.4.0

```
yarn set version 2.4.0
```

### Installs

- The resolution pipeline got reimplemented. We previously used a multi-pass approach where we performed SAT optimization between each pass, but after investigating it turned out the SAT optims had little impact and added performance bottlenecks. We now run the resolution using a much simpler and more efficient algorithm.

- Linkers can now define custom data to cache between Yarn invocations. The builtin linkers new use those new capabilities to cache package information that can't change between runs. In practice, this translates into much faster recurrent installs (when running an install that adds few new packages, if any).

- Warnings are now reported when `packageExtensions` rules are either unused or redundant with the original package definition.

- Potentially breaking, but it was intended this way from the start: the `packageExtensions` field cannot be used to *replace* dependencies anymore (only to add missing ones). Prefer using the `resolutions` field to replace existing ones.

- Progress bars are rendered less often, which should help performances on some terminals.

- Aliased packages no longer include themselves in node_modules installs

### CLI

- The `upgrade-interactive` command will now only show upgrade suggestions for packages that have available upgrades (rather than all of them).

- The `upgrade-interactive` command has received UI improvements that should make it easier to look at.

- The `yarn workspaces focus` command will now only run the `postinstall` scripts for the focused workspaces.

- A new `yarn npm audit` command lets you query audit information from the npm registry.

- The `yarn workspaces foreach` command has a new flag, `-R,--recursive`, which will run a command on the current workspace and all others it depends on.

- A new `--skip-builds` option on `yarn install` will let you skip the build scripts without impacting the generated Yarn artifacts (contrary to `enableScripts`, which would also stop unplugging the packages that would otherwise be unplugged due to containing build scripts).

### Binaries

- It's now possible to run dependency binaries when using the node-modules linker even if one of your other dependencies is reported as incompatible with your system.

- By default Windows automatically requests for administrator rights before spawning any binary whose filename contains "install", "setup", "update", or "patch" (it thinks they are installers). We now explicitly opt-out of this behavior in the binary jumpers we use on Windows.

- By default, arguments passed to MinGW-compiled programs are automatically expanded by a basic glob pattern engine. We now explicitly opt-out of this behavior in the binary jumpers we use on Windows.

- The Windows binary jumpers will now report the right exit code.

### Settings

- Using empty fallbacks in Yarnrc environment variables (`${VAR:-}`) will now work.

- You can now use the new `logFilters` setting to turn warnings into either errors or info, or to hide them entirely. Note that we plan to significantly improve the peer dependency warnings in the next release, so perhaps don't silence them just now even if you have a bunch of them.

### Shell

- Some shell errors (`No matches found`, `Bad file descriptor`, `Unbound variable`, `Unbound argument`) will now be recoverable errors that make the shell continue on to the next command in the chain instead of hard crashes. Fixes cases such as `rm -rf ./inexistentFolder/* || true`.

### VSCode ZipFS Extension

- The extension will now activate even if the workspace doesn't contain zip files (usually because you excluded them).

### Compatibility

- Some patches went missing for TypeScript <4. This is now fixed.

- Calling `fs.exists(undefined)` won't crash anymore.

- TypeScript import suggestions should now be correct even when the imported module is deep within a workspace.

- TypeScript in watch mode (both using `-w` and within VSCode) will now detect new dependencies as you add them.

- Some particular multi-dependency-trees setups will be better supported on Plug'n'Play installs.

- Using `ctrl+click` on imports in VSCode won't take you to virtual packages anymore (require an SDK update).

## 2.3.1

```
yarn set version 2.3.1
```

### CLI
- Take into account peer dependency defaults when inheriting workspace peer dependencies in the node_modules linker

## 2.3.0

```
yarn set version 2.3.0
```

### CLI

- The `yarn tag` set of commands has been ported over from Yarn Classic as `yarn npm tag`.
- Running `yarn info` will now print many information about your dependencies. Various options are available to tweak the output, including `--json`. Plugin authors can provide their own information sections via the `fetchPackageInfo` hook.
- Running `yarn stage` with the `-r,--reset` flag will now unstage all changes that seem related to Yarn.
- All commands now document each of their options (run `yarn add -h` to see an example).
- Publish registry errors will now be reported as is rather than being collapsed into a generic error message.
- A native binary jumper will now be used on Windows to avoid the `Terminate batch job (Y/N)?` prompts when invoking dependency binaries.

### Installs

### PnP API

The following changes only apply to the `pnp` linker (which is the default install strategy):

- The `pnpapi` module now exposes a new function called `getAllLocators` allow you to access the list of all locators in the map without having to traverse the dependency tree. This method is considered a Yarn extension, so you should check for its existence if you plan to use it in your code.
- When using a portal to a package that had peer dependencies, Yarn would loose the information required to resolve those peer dependencies. It will now properly resolve them the same way as all other packages in the dependency tree.

The following changes only apply to the `node-modules` linker:

- The bin symlinks will now be properly removed from the `node_modules/.bin` folder as their corresponding dependencies are removed.
- A new setting called `nmHoistingLimits` has appeared. It replaces what was previously known as `nohoist` in Yarn 1.
- We are now more forgiving for packages that make incorrect assumptions about the hoisting layout by first trying to maximize package exposure at the top-level. Only after the top-level has been populated will we deduplicate the remaining packages.
- Fixed some pathological cases around peer dependencies. In particular, workspaces' peer dependencies will now be resolved against their closest workspace ancestor (according to the directory hierarchy) rather than be ignored. Note that peer dependencies are inherently problematic with workspaces when using the `node-modules` linker, and that the strictly correct behavior can only be obtained by using the default Plug'n'Play linker.
- Running install after an interrupted install is supported now and will result in a consistent install state

### Shell

- Added support for `$$` and `$PPID`
- Fixes some pathological globbing problems.

### Bugfixes

- The `yarn constraints --fix` command will now properly persist the changes on disk.
- The `yarn unplug` command will now work when used on packages with peer dependencies.
- The `yarn stage` command will now allow to stage files when called without the `-c,--commit` flag.
- Fixes a performance regression when using FSEvents.

### Miscellaneous

- Removes extraneous subprocesses when using the `yarnPath` setting.

### Third-party integrations

- Updated the VSCode SDK to take into account changes in the TypeScript server protocol.
- Added a few builtin extensions to improve compatibility with packages that weren't correctly listing their dependencies.
- Updatedd the TypeScript patch to cover TypeScript 4.1.

## 2.2.0

```
yarn set version 2.2.0
```

### Ecosystem

- Packages can now use the `publishConfig.executableFiles` field in their manifests to indicate which files should keep the executable flag once packed in the archive. This is important as for portability reasons Yarn strips the executable flag from all files during packing (otherwise `yarn pack` would yield different outputs when run on Posix vs Windows). Files listed in the `bin` field are assumed executable by default, so you don't need to explicitly list them in `executableFiles`.

### Bugfixes

- Requests won't timeout anymore as long as the server is still sending data.
- `yarn pack` will properly include main/module/bin files, even when not explicitly referenced through the `files` field.
- Local git repositories can now be fetched via the `git+file:` protocol.
- The progress bars will be properly styled when using the new Windows terminal on certain days.
- Yarn will now avoid using deprecated versions of the dependencies, unless only deprecated versions are available for the requested ranges.
- Build keys are now properly computed, which fixes issues where build scripts weren't always triggered when they should have been.
- Negated glob patterns in the `workspace` field will now be processed correctly.
- Yarn will now allow relative paths inside the `workspace:` protocol to start with `./`
- Yarn will now show the actual error when it fails to resolve a request during `yarn add` and `yarn up`
- The portable shell will now support calling `cd` and `exit` without arguments
- Yarn will now show the exit code when a lifecycle script fails
- Yarn's portable shell will now also pipe the stderr when using the `|&` pipeline
- Yarn's portable shell will now respect the left associativity of list operators

### CLI

- Yarn will now report an error when run through an incompatible Node version.
- `yarn add` and `yarn up` will now respect the `preferInteractive` configuration option.
- `yarn config set` now supports the `-H,--home` flag, which causes it to update the home configuration instead of the project configuration.

### Configuration

- The settings found in the home configuration file won't cause exceptions when consumed by older Yarn versions. Unsupported options will simply be silently ignored. This should improve the user experience when working with multiple projects configured with different Yarn versions.
- A new `immutablePaths` setting allow you to specify paths that must not change when running Yarn with the `--immutable` flag set. You can use it to detect unforeseen changes to your install artifacts, be it `.pnp.js` or `node_modules` files.

### Miscellaneous

- Scripts can now use the `$RANDOM` variable as well as simple calculations using `+`, `-`, `*`, `/` and `()` inside `$(())`
- Scripts can now use grouping curly braces (`{echo foo}`) to execute a command in the context of the current shell (without creating a subshell like in the case of `(echo foo)`).
- Scripts can now end with a semicolon.
- PnP linker will not remove lingering node_modules inside folders matching `pnpIgnorePatterns`

### Third-party integrations

- The PnP hook will now display clearer error message when requiring Node builtins from contexts that can't access them out of the box (for example when accessing the `fs` module from within a Webpack browser bundle).

## 2.1.1

```
yarn set version 2.1.1
```

- Fixed hyperlink rendering on iTerm

## 2.1.0

```
yarn set version 2.1.0
```

### Ecosystem

- Packages can now declare they they *need* to be unpacked in order to be functional using the new `"preferUnplugged": true` field in the manifest. This will hurt the experience of your users (your project will be the only one that will require hard installs), so please refrain using this field unless there's no other choice.

### New commands

- Running `yarn search` will open a rich interface to search for packages to install (requires the `interactive-tools` plugin).
- Running `yarn npm logout` will remove your credentials from your home directory.
- Running `yarn plugin import from sources` will allow you to build plugins from the master branch of the our repository.
- Running `yarn workspaces focus` will only install the current workspace, plus any other workspace it might depend on. The `--production` flag will only install their production dependencies.
- Running `yarn exec` will execute the specified command at the root of the current workspace (reintroduced from the Classic branch).
- Running `yarn create` is now an alias to `yarn dlx` (with the `create-` prefix.)

### CLI

- `yarn init` will now generate an [EditorConfig](https://editorconfig.org) file, and run `git init` on the resulting folder.
- `yarn init` now supports a `-i` flag which will automatically pin the Yarn version in the project.
- `yarn init` will now inject the settings from the `initFields` configuration setting when generating the initial manifest (future release will remove the now deprecated `initVersion` and `initLicense` settings).
- `yarn init` will now initialize a workspace project if given the `-w` flag.
- `yarn workspaces foreach` now support glob patterns in `--include` and `--exclude`.
- `yarn set version` now as an alias called `yarn policies set-version` (will be deprecated in 3.x).
- `yarn run` now supports the `--inspect` and `--inspect-brk` switches for binaries (for example `yarn run --inspect-brk jest`).
- `yarn remove` and `yarn up` now support glob patterns.
- `yarn dlx` now respects the local project configuration (particularly the configured registries). This is still experimental and will be further improved in the next months.
- `yarn dlx` now properly exits with an exit code when the underlying command returned an exit code too.
- `yarn config get` (and `set`) can now access nested configuration values (for example, `yarn config get npmScopes.foo.npmRegistryServer` will tell you which server is configured for the given server, if any).
- `yarn config get` will now hide its secrets (or rather yours) from the rest of the world. A new `--no-redacted` option will toggle off this behavior if needed.
- `yarn config set` now has a `--json` option that will let Yarn know it should interpret the given value as a JSON object (useful to set server configuration, etc).
- `yarn workspace foreach` will now exit with the expected status code if there's an error.

### Configuration

- Registry auth settings can now be declared per-scope (they previously had to be per-registry). This will be handy with the GitHub Package Registry model, where each scope may have different access tokens.
- The configuration file now interpolates the values with the environment variables using the `${name}` syntax (strict by default; use `${name:-default}` to provide a default value).
- The new `changesetIgnorePatterns` setting can be used to ignore some paths from the changeset detection from `yarn version check` (changes to those paths won't be taken into account when deciding which workspaces need to fresh releases).
- The new `changesetBaseRef` setting can be used to change the name of the master branch that `yarn version check` will use in its changeset heuristic.
- The new `httpTimeout` and `httpRetry` settings allow you to configure the behavior of the HTTP(s) requests.
- The new `preferTruncatedLines` setting allow you to tell Yarn that it's ok if info and warning messages are truncated to fit in a single line (errors will always wrap as much as needed, and piping Yarn's output will toggle off this behaviour altogether).
- The cache compression level can now be configured through `compressionLevel`. If you don't use Zero-Installs, using a value of `0` may yield speed improvements at little cost.
- Plugins are now loaded from the location of the RC file.

### Protocols

- The Git protocol has been improved, and now supports multiple patterns that were missing.
- The Git protocol can now clone any workspace from a given repository. To do this, use the `owner/repo#workspace=name` syntax (which you can mix with branch names as usual).
- The repositories cloned using the Git protocol will now automatically disable `core.autocrlf` so that the builds lead to deterministic results. Generally speaking, improvements have been made to avoid freshly built packages from generating different results.
- Packages fetched using the Git protocol will now be built using either of Yarn 1, Yarn 2, npm, or pnpm. The choice will be made based on the content of the sources (for example, we will pack the project using `npm pack` if we detect a `package-lock.json`).
- The `exec:` protocol has a different API. In particular, builtin modules can now be accessed without having to actually require them.

### Installs

- Deprecation warnings are now shown during installs.
- The out-of-file PnP data generation has been fixed (it allows to generate the PnP data in a JSON file separated from the JS loader itself).
- An edge case in the virtual instances deduplication has been fixed; packages with the same effective peer dependencies now always share the exact same instance.
- The heuristic we use to locate zip files within paths has been improved. As a result, running ESLint on our repository now takes 28s instead of 57s.
- Yarn will now exclude the node_modules folder from the workspace detection. As a result, listing `**/*` in your `workspaces` field will now detect all child packages as workspaces.
- The cache names have changed in order to make the cache content-addressed. In particular, this mean that in the event where we need to fix a bug in the fetch steps, we won't need to bump a global cache key anymore.
- The PnP linker now features an additional loose mode (optional, and enabled through the `pnpMode: loose` setting). Under this mode, Yarn will compute the list of packages that would have been hoisted under the node_modules linker, and let the application code access them with only a warning. This mode will however not become the default - warnings cannot be caught by the application code, and as a result the output of the loose mode can be quite verbose, often being more confusing than the strict mode.
- Because we're aware of no incorrect hoisting bug on the v2 (but have discovered a few in the v1), and because its performances are about the same, the node_modules linker from Yarn 2 is now deemed more stable than the one from the v1, and we recommend users to migrate to it even if you don't want to use Plug'n'Play. More improvements are to come, but they'll mostly be in the user experience (for example to mix PnP and nm into a single install).

### Rendering

- Rendering on small terminals (or terminals which didn't expose their size) could lead to failed assertions. This is now fixed.
- The output of `yarn upgrade-interactive` has been revamped to reintroduce some elements that had been omitted when porting the command from the v1 to the v2.
- Error codes are now hyperlinks on compatible terminals.

### Third-party integrations

- The PnP hook will now display the list of packages that broke the peer dependency chain (it previously only showed the name of the package that wasn't provided the peer dependency, but not the name of which ancestor was responsible).
- We have added `lutimes` support into Node itself, since it was otherwise impossible to implement perfect copy mechanisms (the copied symlinks would end up with different mtime than their originals).
- The SDK files have been moved from `.vscode/pnpify` to `.yarn/sdks`.
- Improvements have been made in the VSCode integration. In particular, the PnP support is now good enough that it started to fix some longstanding issues that VSCode had with properly naming workspaces.
- We have contributed to VSCode support for third-party protocols with TypeScript. As a result, zip archives now properly support the "Jump to definition" workflow (this requires the [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) extension to be installed).
- The SDK output has been migrated to the same standard as the other commands.
- The SDK can now prepare the development environment for both VSCode and Vim. More third-party tools have been added, such as the Svelte extension. Note: the SDK is only needed for editor integrations; you don't need it if you just want to author JavaScript on basic text editors.

### Miscellaneous

- Scripts can now use glob patterns, which will be resolved regardless of the underlying shell (so it'll work on Windows as well as Linux). Note that this only covers file globbing - using something like `echo {foo,bar}` won't work expect if there's actually a file named `foo` and/or `bar`.
- Sending SIGKILL (or other signals) to the Yarn process wasn't causing the child processes to stop. Yarn will now forward the signal, and wait for its children to exit.
- Some temporary folders weren't properly cleaned up; this has been fixed.
- Support for the `.cjs` extension has been added to multiple files in order to make it easier to use `"type": "module"`.
- The bundle has received various size and startup time optimizations.

---

## 2.0.0

```
yarn set version 2.0.0
```

Remember that a [migration guide](https://yarnpkg.com/getting-started/migration) is available to help you port your applications to Yarn 2.

### Notable fixes

  - Using `yarn link` will now properly resolve peer dependencies based on the package that requires the linked package rather than the dependencies installed in the linked project folder.

  - Packages will now only be built when one of their dependencies is changed in some way. Note that this includes both direct dependencies and transitive dependencies, which might trigger unintuitive rebuilds in some case (for example, since `node-sass` depends on `lodash.assign`, upgrading `lodash.assign` will trigger a rebuild). This will be improved in a later release by introducing a new `runtime` field for the `dependenciesMeta` object that will exclude the package from the build key computation (feel free to start setting this flag as of now, even if it won't have any effect until then).

  - Registry hostnames finally aren't part of the lockfile anymore. It means that you can switch the registry at any time by changing the `npmRegistryServer` settings. One unfortunate limitation is that this doesn't apply to registries that use non-standard paths for their archives (ie `/@scope/name/-/name-version.tgz`). One such example is NPM Enterprise, which will see the full path being stored in the lockfile.

  - The `--immutable` option (new name for `--frozen-lockfile`) will now properly report when the lockfile would be changed because of entry removals (it would previously only reject new entries, not removals).

### Notable changes

  - We dropped support for Node 8, which has reached its end of life in December.

  - Accessing registries through http is now forbidden by default (Yarn will throw an exception and require to use https instead). This can be overruled on a per-hostname basis by using [`unsafeHttpWhitelist`](https://yarnpkg.com/configuration/yarnrc#unsafeHttpWhitelist).

  - The meaning of `devDependencies` is slightly altered. Until then dev dependencies were described as "dependencies we only use in development". Given that we now advocate for all your packages to be stored within the repository (in order to guarantee reproducible builds), this doesn't really make sense anymore. As a result, our description of dev dependencies is now "dependencies that aren't installed by the package consumers". It doesn't really change anything else than the name, but the more you know.

      - One particular note is that you cannot install production dependencies only at the moment. We plan to add back this feature at a later time, but given that enabling [Zero-Installs](https://yarnpkg.com/features/zero-installs) would cause your repository to contain all your packages anyway (prod & dev), this feature isn't deemed as important as it used to be.

  - Running `yarn link <package>` now has a semi-permanent effect in that `<package>` will be added as a dependency of your active workspace (using the new `portal:` protocol). Apart from that the workflow stays the same, meaning that running `yarn link` somewhere will add the local path to the local registry, and `yarn link <package>` will add a dependency to the previously linked package.

      - To disable such a link, just remove its `resolution` entry and run `yarn install` again.

  - The Yarn configuration has been revamped and *will not read the `.npmrc` files anymore.* This used to cause a lot of confusion as to where the configuration was coming from, so the logic is now very simple: Yarn will look in the current directory and all its ancestors for `.yarnrc.yml` files.

      - Note that the configuration files are now called `.yarnrc.yml` and thus are expected to be valid YAML. The available settings are listed [here](https://yarnpkg.com/configuration/yarnrc).

  - The lockfiles now generated should be compatible with Yaml, while staying compatible with old-style lockfiles. Old-style lockfiles will be automatically migrated, but that will require some round-trips to the registry to obtain more information that wasn't stored previously, so the first install will be slightly slower.

  - The cache files are now zip instead of tgz. This has an impact on cold install performances, because the currently available registries don't support it, which requires us to convert it on our side. Zero-Install is one way to offset this cost, and we're hoping that registries will consider offering zip as an option in the future.

      - We chose zip because of its perfect combination in terms of tooling ubiquity and random access performances (tgz would require to decompress the whole archive to access a single file).

### Package manifests (`package.json`)

To see a comprehensive documentation about each possible field, please check our [documentation](https://yarnpkg.com/configuration/manifest).

  - Two new fields are now supported in the `publishConfig` key of your manifests: the `main`, `bin`, and `module` fields will be used to replace the value of their respective top-level counterparts in the manifest shipped along with the generated file.

    - The `typings` and `types` fields will also be replaced if you use the [TypeScript plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-typescript).

  - Two new fields are now supported at the root of the manifest: `dependenciesMeta` and `peerDependenciesMeta` (`peerDependenciesMeta` actually was supported in Yarn 1 as well, but `dependenciesMeta` is a new addition). These fields are meant to store dependency settings unique to each package.

    - Both of these new fields, and all settings the support, are entirely optional. Yarn will keep doing what you expect if they're not there - they're just a mechanism to expose more fine-grained settings.

    - Some of those settings can only be declared in the project top-level manifest and will be ignored anywhere else (for example `built`), while others will have a per-package effect (for example `optional`). As a rule of thumb, `dependenciesMeta` settings are always project-wide (and thus are only taken into account in the top-level package.json) while `peerDependenciesMeta` settings are package-specific.

    - The `dependenciesMeta` field covers dependencies declared in either of the `dependencies` and `devDependencies` fields.

    - The `dependenciesMeta` field accepts two types of keys: either a generatic package name (`lodash`), or a specialized package **version** (`lodash@1.2.3`). This later syntax only works for the top-level manifest and *will thus be ignored when seen in a dependency / transitive dependency*.

  - The `dependenciesMeta[].comment` field is expected to be a string field. Even though it isn't actually used anywhere at the moment, we suggest you to write comments regarding the reason why some packages are used here rather than anywhere else. This might prove useful for plugin authors.

  - The `dependenciesMeta[].built` field is a boolean flag; setting it to `false` will cause the package manager to ignore this package when considering the list of packages that need to be built. If the project uses `enable-scripts: false`, the warning that would have traditionally been emitted will be downgraded into a simple notice. This settings is project-wide.

  - The `peerDependenciesMeta[].optional` field is a boolean flag; setting it to `true` will stop the package manager from emitting a warning when the specified peer dependency is missing (you typically want to use it if you provide optional integrations with specific third-party packages and don't want to pollute your users' installs with a bunch of irrelevant warnings). This settings is package-specific.

  - The `resolutions` field no longer support the glob syntax within its patterns, as it was redundant with its own glob-less syntax and caused unnecessary confusion.

    ```diff-json
    {
      "resolutions": {
    -    "**/@babel/core": "7.5.5",
    +    "@babel/core": "7.5.5",
      }
    }
    ```

### Workspaces

  - Workspaces can now be referenced using the special `workspace:` protocol. This protocol accepts either a relative path to the workspace, or a semver range that will be compared against the `version` fields from candidate workspaces.

  - Workspaces don't have to specify a version anymore. If referenced through the `workspace:` resolver, the engine will assume that they have the version `0.0.0` (which makes `workspace:*` a good way to say "shut up and take my workspace").

    - That being said, workspaces referenced through the `workspace:` protocol will see their referenced changed at pack-time *if the target workspace defines a version*. An error will be thrown otherwise and the package won't be packable.

  - Workspaces can now contain sub-workspaces. This follow the same restriction than before, meaning that any workspace that wishes to expose sub-workspaces must be declared `private: true`.

### CLI

  - The npm-specific commands (such as `yarn login` or `yarn publish`) have been moved into a specific namespace (`yarn npm login` / `yarn npm publish`). This doesn't affect the `yarn pack` command which is considered generic enough for the top-level.

  - Running `yarn <path> add ...` will run the `add` command into the location pointed by `<path>`. This is true for any command. The only limitation is that `<path>` must be either be `.`, `..`, or must contain a slash (in order to disambiguate with script and command names).

  - Running `yarn add -P <package>` will use `*` by default instead of resolving a new range for `<package>`. This change only affects peer dependencies (`-P`), and can be disabled by manually specifying the range (`yarn add -P lodash@^4.0.0`).

  - Running `yarn add <package> -i` will now make suggestions based on the dependencies from your other workspaces. This behavior can be made a default by setting `preferInteractive` to `true` in your settings.

  - Running `yarn foo:bar` will run the `foo:bar` script regardless of what workspace declares it as long as only one workspace declares it. *This change only affects scripts whose names contains at least one colon.*

  - Running `yarn remove -A <package>` will remove `<package>` from all the dependency sets from all your workspaces, regardless of what your cwd is.

  - Running `yarn set resolution <package> <resolution>` will force the resolver to use a specific resolution for the given package descriptor. Note that the descriptor passed as parameter must be exactly the same as the one you want to override. This command is a handy tool to manually optimize some ranges that could benefit from overlapping.

  - Running `yarn up <package>` will upgrade `<package>` in all of your workspaces at once (only if they already use the specified package - those that don't won't see it being added). Adding the `-i` flag will also cause Yarn to ask you to confirm for each workspace.

  - Running `yarn config --why` will tell you the source for each value in your configuration. We recommend using it when you're not sure to understand why Yarn would have a particular settings.

  - Running `yarn pack` will no longer always include *nested* README, CHANGELOG, LICENSE or LICENCE files (note that those files will still be included if found at the root of the workspace being packed, as is usually the case). If you rely on this ([somewhat unintended](https://github.com/npm/npm-packlist/blob/270f534bc70dfb1d316682226332fd05e75e1b14/index.js#L162-L168)) behavior you can add those files manually to the `files` field of your `package.json`.

  - The `yarn upgrade-interactive` command has been moved into a plugin that needs to be installed through `yarn plugin import interactive-tools`. It's also been rewritten, and we'll keep improving over time.

### Miscellaneous

  - A new protocol is now supported, `portal:`. Portals are very much like `link:` in that they directly point to a location on the disk, but unlike links they also take into account the dependencies of the target location (whereas links don't care about these). To give you a better idea, portals are what you use when you want to target a *package*, whereas links are what you use when you want to target a non-package folder (for example your `src` directory, or similar).

  - A new protocol is now supported, `patch:`. The patch protocol can be used to automatically apply changes to the sources of a package. It's very similar to [`patch-package`](https://github.com/ds300/patch-package), but is directly integrated within Yarn (including its cache and checksum systems).
