## Master

### Notable fixes

  - Using `yarn link` will now properly resolve peer dependencies based on the package that requires the linked package rather than the dependencies installed in the linked project folder.

  - Packages will now only be built when one of their dependencies is changed in some way. Note that this includes both direct dependencies and transitive dependencies, which might trigger unintuitive rebuilds in some case (for example, since `node-sass` depends on `lodash.assign`, upgrading `lodash.assign` will trigger a rebuild). This will be improved in a later release by introducing a new `runtime` field for the `dependenciesMeta` object that will exclude the package from the build key computation (feel free to start setting this flag as of now, even if it won't have any effect until then).

  - Registry hostnames finally aren't part of the lockfile anymore. It means that you can switch the registry at any time by changing the `npmRegistryServer` settings. One unfortunate limitation is that this doesn't apply to registries that use non-standard paths for their archives (ie `/@scope/name/-/name-version.tgz`). One such example is NPM Enterprise, which will see the full path being stored in the lockfile.

  - The `--immutable` option (new name for `--frozen-lockfile`) will now properly report when the lockfile would be changed because of entry removals (it would previously only reject new entries, not removals).

### Notable changes

  - The meaning of `devDependencies` is slightly altered. Until then dev dependencies were described as "dependencies we only use in development". Given that we now advocate for all your packages to be stored within the repository (in order to guarantee reproducible builds), this doesn't really make sense anymore. As a result, our description of dev dependencies is now "dependencies that aren't installed by the package consumers". It doesn't really change anything else than the name, but the more you know.

      - One particular note is that you cannot install production dependencies only at the moment. We plan to add back this feature at a later time, but given that Zero-Installs means that your repository contains all your packages (prod & dev), the priority isn't as high as it used to be.

  - Running `yarn link <package>` now has a semi-permanent effect in that `<package>` will be added as a dependency of your active workspace (using the new `portal:` protocol). Apart from that the workflow stays the same, meaning that running `yarn link` somewhere will add the local path to the local registry, and `yarn link <package>` will add a dependency to the previously linked package.

      - To disable such a link, just remove its `resolution` entry and run `yarn install` again.

  - The Yarn configuration has been revamped and *will not read the `.npmrc` files anymore.* This used to cause a lot of confusion as to where the configuration was coming from, so the logic is now very simple: Yarn will look in the current directory and all its ancestors for `.yarnrc.yml` files.

      - Note that the configuration files are now called `.yarnrc.yml` and thus are expected to be valid YAML. The available settings are listed [here](https://next.yarnpkg.com/configuration/yarnrc).

  - The lockfiles now generated should be compatible with Yaml, while staying compatible with old-style lockfiles. Old-style lockfiles will be automatically migrated, but that will require some round-trips to the registry to obtain more information that wasn't stored previously, so the first install will be slightly slower.

  - The cache files are now zip instead of tgz. This has an impact on cold install performances, because the currently available registries don't support it, which requires us to convert it on our side. Zero-Install is one way to offset this cost, and we're hoping that registries will consider offering zip as an option in the future.

      - We chose zip because of its perfect combination in terms of tooling ubiquity and random access performances (tgz would require to decompress the whole archive to access a single file).

### Package manifests (`package.json`)

To see a comprehensive documentation about each possible field, please check our [documentation](https://next.yarnpkg.com/configuration/manifest).

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

  - Running `yarn policies set-resolution <package> <resolution>` will force the resolver to use a specific resolution for the given package descriptor. Note that the descriptor passed as parameter must be exactly the same as the one you want to override. This command is a handy tool to manually optimize some ranges that could benefit from overlapping.

  - Running `yarn up <package>` will upgrade `<package>` in all of your workspaces at once (only if they already use the specified package - those that don't won't see it being added). Adding the `-i` flag will also cause Yarn to ask you to confirm for each workspace.

  - Running `yarn config --why` will tell you the source for each value in your configuration. We recommend using it when you're not sure to understand why Yarn would have a particular settings.

  - Running `yarn pack` will no longer always include *nested* README, CHANGELOG, LICENSE or LICENCE files (note that those files will still be included if found at the root of the workspace being packed, as is usually the case). If you rely on this ([somewhat unintended](https://github.com/npm/npm-packlist/blob/270f534bc70dfb1d316682226332fd05e75e1b14/index.js#L162-L168)) behavior you can add those files manually to the `files` field of your `package.json`.

### Miscellaneous

  - A new protocol is now supported, `portal:`. Portals are very much like `link:` in that they directly point to a location on the disk, but unlike links they also take into account the dependencies of the target location (whereas links don't care about these). To give you a better idea, portals are what you use when you want to target a *package*, whereas links are what you use when you want to target a non-package folder (for example your `src` directory, or similar).
