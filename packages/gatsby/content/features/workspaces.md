---
category: features
path: /features/workspaces
title: "Workspaces"
---

The Yarn workspaces are a feature designed to make monorepos easy to use, solving one of the main use cases for `yarn link` in a more declarative way. In short, they allow multiple of your projects to live together in the same repository AND to cross-reference each others.

First, some vocabulary: in the context of the workspace feature, a *project* is the whole directory tree making up your workspaces (often the repository itself). A *workspace* is a specific named package stored anywhere within the project. Finally, a *worktree* is the name given to private packages that list their own child workspaces. A project contains one or more worktrees, which may themselves contain any number of workspaces.

## How to declare a worktree?

Worktrees are defined through the traditional `package.json` files. What makes them special is that they have the following properties:

- They have to be marked `private: true`. This requirement exists because workspaces are a client-only feature. The remote registries (such as the npm registry) have no idea what a workspace is, and neither should they. In order to prevent accidental pushes and information leaks workspaces must have their private flag set.

- They must declare a `workspaces` field which is expected to be an array of glob patterns that should be used to locate the workspaces that make up the worktree. For example, if you want all folders within the `packages` folder to be workspaces, just add `workspaces/*` to this array.

- They must be connected in some way to the project-level `package.json` file. This doesn't matter in the typical workspace setup because there's usually a single worktree defined in the project-level `package.json`, but if you try to setup nested workspaces then you must make sure that the nested worktree is defined as a valid workspace of its parent worktree (otherwise Yarn won't find its correct parent folder).

Note that because worktrees are defined with an otherwise regular `package.json` file, they also are valid workspaces themselves. If they're named, other workspaces will be able to properly cross-reference them.

## What does it mean to be a workspace?

Workspaces have two important properties:

- Only the dependencies depended upon by a workspace can be accessed. Said another way, we strictly enforce your workspaces dependencies. Doing this allows to cleanly decouple projects from one another, since you don't have to merge all their dependencies in one huge unmaintainable list. We still provide tools to manage dependencies from multiple workspaces at once, but they need to be explicitly used and offer a better integration (for example `yarn add` can make suggestions for your new dependencies based on what other workspaces use, but you can override them).

- If the package manager was to resolve a range that a workspace could satisfy, it will prefer the workspace resolution over the remote resolution if possible. This is the pillar of the monorepo approach: rather than using the remote packages from the registry, your project packages will be interconnected and will use the code stored within your repository.

## Workspace ranges (`workspace:`)

While Yarn automatically picks workspace resolutions when they match, there are times where you absolutely don't want to risk using a package from the remote registry even if the versions don't match (for example if your project isn't actually meant to be published and you just want to use the workspaces to better compartiment your code).

For those use cases, Yarn now supports a new resolution protocol starting from the v2: `workspace:`. When this protocol is used Yarn will refuse to resolve to anything else than a local workspace. This range protocol has two flavors:

  - If a semver range, it will select the workspace matching the specified version.
  - If a project-relative path, it will select the workspace that match this path **(experimental)**.

Note that the second flavor is experimental and we advise against using it for now, as some details might change in the future. Our current recommendation is to use `workspace:*`, which will almost always do what you expect.

## Yarn Workspaces vs Lerna

Despite the appearances, the Yarn workspaces and Lerna don't compete. In fact, Lerna will uses Yarn's workspaces if possible. In a sense, you can see Lerna as a high-level layer on top of the low-level Yarn implementation.
