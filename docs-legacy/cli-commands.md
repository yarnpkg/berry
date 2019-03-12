---
id: cli-commands
title: CLI Commands
sidebar_label: CLI Commands
---

The following document is a comprehensive list of all the commands available in Yarn, including those that belong to external plugins. If you notice that a command or an option isn't properly documented, please help us improve the documentation and [open a PR]()!

Note that the best way to access

## `yarn add [...packages]`

This command adds a package to the `package.json` for the nearest workspace.

- The package will by default be added to the regular dependencies field (`dependencies`), but this behavior can be overriden thanks to the `-D,--dev` flag (which will cause the dependency to be added to the `devDependencies` field) and the `-P,--peer` flag (which will do the same but for `peerDependencies`).

- If the added package doesn't specify a range at all its `latest` tag will be resolved and the returned version will be used to generate a new semver range (using the `^` by default, or `~` if `-T,--tilde` is specified, or nothing if `-E,--exact` is specified). One exception: if you use `-P,--peer` the default range will be `*` (and won't be resolved at all).

- If the added package specifies a tag range (such as `latest` or `rc`), Yarn will resolve this tag to a semver version and use that in the resulting `package.json` (meaning that `yarn add foo@latest` will have exactly the same effect as `yarn add foo`).

- For a compilation of all the supported protocols, please consult the [dedicated page]().

```
$> yarn add lodash
$> yarn add lodash@^1.2.3
```

## `yarn bin []`

This command print

## `yarn config`

## `yarn config set`

## `yarn exec`

## `yarn help`

## `yarn install`

## `yarn node`

## `yarn remove`

## `yarn run`

## `yarn unplug`

## `yarn constraints apply`

## `yarn constraints check`

## `yarn constraints detail`

## `yarn constraints source`

## `yarn policies set-version`

## `yarn workspaces foreach`

## `yarn workspaces list`
