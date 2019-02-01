## Master

### Notable fixes

  - Using `yarn link` will now properly resolve peer dependencies based on the package that requires the linked package rather than the dependencies installed in the linked project folder.

  - Packages will now only be built when one of their dependencies is changed in some way. Note that this includes both direct dependencies and transitive dependencies, which might trigger unintuitive rebuilds in some case (for example, since `node-sass` depends on `lodash.assign`, upgrading `lodash.assign` will trigger a rebuild). This will be improved in a later release by introducing a new `runtime` field for the `dependenciesMeta` object that will exclude the package from the build key computation (feel free to start setting this flag as of now, even if it won't have any effect until then).

  - Registry hostnames finally aren't part of the lockfile anymore. It means that you can switch the registry at any time by changing the `npmRegistryServer` settings. One unfortunate side effect is that NPM Enterprise cannot be supported by default anymore (they use their own weird conventions), and as such you will need to enable `npmRegistryEnterprise: true` in your settings if you're in this case. Send complaints to npm.

### Workspaces

  - Workspaces can now be referenced using the special `workspace:` protocol. This protocol accepts either a relative path to the workspace, or a semver range that will be compared against the `version` fields from candidate workspaces.

  - Workspaces don't have to specify a version anymore. If referenced through the `workspace:` resolver, the engine will assume that they have the version `0.0.0` (making `workspace:*` a good way to say "shut up and take my workspace").

  - Workspaces can now contain sub-workspaces. This follow the same restriction than before, meaning that any workspace that wishes to expose sub-workspaces must be declared `private: true`.

### CLI

  - Running `yarn <path> add ...` will run the `add` command into the location pointed by `<path>`. This is true for any command. The only limitation is that `<path>` must be either be `.`, `..`, or must contain a slash (in order to disambiguate with script and command names).

  - Running `yarn add -P <package>` will use `*` by default instead of resolving a new range for `<package>`. This change only affects peer dependencies (`-P`), and can be disabled by manually specifying the range (`yarn add -P lodash@^4.0.0`).

  - Running `yarn add <package> -i` will now make suggestions based on the dependencies from your other workspaces. This behavior can be made a default by setting `preferInteractive` to `true` in your settings.

  - Running `yarn foo:bar` will run the `foo:bar` script regardless of what workspace declares it as long as only one workspace declares it. *This change only affects scripts whose names contains at least one colon.*

  - Running `yarn remove -A <package>` will remove `<package>` from all the dependency sets from all your workspaces, regardless of what your cwd is.
