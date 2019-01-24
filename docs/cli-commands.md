---
id: cli-commands
title: CLI Commands
sidebar_label: CLI Commands
---

The following document is a comprehensive list of all the commands available in
Yarn, including those that belong to external plugins. If you notice that a
command or an option isn't properly documented, please help us improve the
documentation and [open a PR]()!

## `yarn add`

This command imply adds a package to the `package.json` for the nearest
workspace.

- The package will be added to the production dependencies by default, but can
  also be added to the development dependencies by the use of the `-D,--dev`
  flag.

- If the added package doesn't specify a range its `latest` tag will be
  resolved and the returned version will be used to generate a new semver range
  (using the `^` by default, or `~` if `-T,--tilde` is specified, or nothing if
  `-E,--exact` is specified).

- Similarly, if the added package specifies a tag range (such as `latest` or
  `rc`), Yarn will resolve this tag to a semver version and use that in the
  resulting `package.json` (meaning that `yarn add foo@latest` will have
  exactly the same effect as `yarn add foo`).

## `yarn bin`

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
