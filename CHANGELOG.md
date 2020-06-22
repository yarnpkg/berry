# Changelog

## Master

**Note:** features in `master` can be tried out by running `yarn set version from sources` in your project (plus any relevant plugin by running `yarn import plugin from sources <name>`).

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

Remember that a [migration guide](https://yarnpkg.com/advanced/migration) is available to help you port your applications to Yarn 2.

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

    ```diff
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
