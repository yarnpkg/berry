---
category: features
slug: /features/workspaces
title: "Workspaces"
description: A tour of what Yarn has to offer to monorepo projects.
---

## What are workspaces?

Workspaces are the name of individual packages that are part of the same project and that Yarn will install and link together to simplify cross-references.

This pattern is often called monorepo when used in conjunction with a repository. Workspaces were initially popularized by projects like Lerna, but Yarn was the first package manager to provide native support for them - support which never stopped improving over years as we build more features around them.

:::info
We always try to dogfood the features we offer, and workspaces are a prime example: Yarn is composed of a couple of dozens of packages that can each be deployed independently if needed!
:::

## When should I use workspaces?

Workspaces shine in many situations, with the main ones being:

- When a project has a core package surrounded with various add-ons; this is for example the case for Babel.

- When you need to publish multiple packages and want to avoid your contributors having to open PRs on many separate repositories whenever they want to make a change. This is for example the case for Jest.

- Or when projects want to keep strict boundaries within their code and avoid becoming an entangled monolith. This is for example the case for Yarn itself, or many enterprise codebases.

There's been a significant amount of discussions about whether monorepos are good or bad, with decent arguments on both side. Our team worked with monorepos for years at this point, and with the tooling Yarn provides, the value has always outweighed the cons by a large margin. If you need to create another package for your project, consider whether grouping them together makes sense.

:::tip
You don't need to split your code in many workspaces for them to become useful. For instance, the [Clipanion repository](https://github.com/arcanis/clipanion) uses only two workspaces, one for the library and one for its website. This patterns avoids mixing dependencies while also making it easy to author PRs that affect both the code and the documentation.
:::

## How are workspaces declared?

To declare a workspace, all you have to do is add a `workspaces` array to the root `package.json` file, and list relative glob patterns pointing to your workspaces' folders. In the following example, all subdirectories in the `packages` folder will become workspaces.

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

## Workspace-related features

### Constraints

Constraints are to monorepos what Eslint is to your source code. They let you declare rules that must apply to specific workspaces in your project. For example, you can use constraints to enforce that all dependencies in your project are synchronized, to prevent some dependencies from being used, or to enforce that some fields such as `license` or `engines.node` are properly set everywhere.

For more information and examples about constraints, check the [dedicated article](/features/constraints).

### Cross-references

Packages from monorepos often need to depend on each other - for example when you have an app package depending on a separate library. Yarn makes it very easy thanks to the special `workspace:` protocol, which lets you instruct Yarn to resolve the dependency using the workspace of the same name in the project. For example:

```json
{
  "dependencies": {
    "@my-org/utils": "workspace:^"
  }
}
```

The `workspace:` protocol accepts either a regular semver range, or the special `^` / `~` / `*` tokens. Whatever the value is won't change how Yarn will resolve the dependency (it will only ever care about the dependency name), but it will affect what the dependency will look like after the package gets published via `yarn npm publish`. For example, if the following ranges are used against a workspace whose `version` field is set to `3.2.1`:

| Initial range | Range after publish |
| --- | --- |
| `workspace:^3.0.0` | `^3.0.0` |
| `workspace:^` | `^3.2.1` |
| `workspace:~` | `~3.2.1` |
| `workspace:*` | `=3.2.1` |

### Focused installs

A common concern when discovering workspaces is how you need to install all of their dependencies whenever you wish to work on a single one of them. Yarn provides a solution via `yarn workspaces focus`.

This command takes a list of workspaces, extend the list to include transitive dependencies, and exclude everything else from the install. For example, the following would let you install only the dependencies required for your main app to be built and deployed:

```
yarn workspaces focus @my-org/app
```

If you wish to also skip installing `devDependencies`, set the `yarn workspaces focus ! --production` flag. In the following example, Yarn will install the dependencies from all workspaces, but only the production ones:

```
yarn workspaces focus -A --production
```

### Global scripts

Scripts defined in the `scripts` field from the `package.json` files can be run using `yarn run name`, but only if you run the command from within the workspaces that declare them. That is, unless they are global scripts.

Global scripts are characterized by at least one colon (`:`) in the script name. They can be run from anywhere within the project, as long as there are no duplicates (if two workspaces define scripts with the same names, they won't be upgraded into global scripts).

### Parallel execution

Scripts from multiple workspaces can be run in parallel if they share the same name, by using `yarn workspaces foreach`. The following example shows you how to publish all packages in your project in parallel, but respecting topological order (so that a workspace only gets published once all other workspaces it depends on did):

```
yarn workspaces foreach --all -pt npm publish
```

The `yarn workspaces foreach ! --all` flag will run the provided command on every workspace in the project, but it can be tweaked. In this example we use the `yarn workspaces foreach ! --since` flag to instead only select workspaces that were modified in the current branch compared to the [main branch](/):

```
yarn workspaces foreach --since run lint
```

Similarly, the `yarn workspaces foreach ! --from pattern` flag will instead select all workspaces matching the provided glob pattern. As for all other Yarn commands, this flag will be applied to both workspace names and paths relative to the current working directory. For example, this command will run the `build` script on the current workspace and all other workspaces it depends on:

```
yarn workspaces foreach --from . -R run build
```
