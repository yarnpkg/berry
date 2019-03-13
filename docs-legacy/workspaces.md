---
id: workspaces
title: Workspaces
sidebar_label: Workspaces
---

Workspaces are a feature designed to make monorepo easy to use, and solve most
of the use cases for `yarn link` in a safer fashion. They allow multiple of
your projects to live together in the same repository AND to cross-reference
each other.

First, some vocabulary: in the context of the workspace feature, a *project* is
the whole directory tree making up your workspaces (often the repository
itself). A *workspace* is a specific named package inside the monorepo.
Finally, a *worktree* is the name given to private packages that define new
workspaces.

## How to declare a worktree?

> Reminder: the worktree is a package that defines workspaces.

Worktrees are defined via the use of a traditional `package.json` file. What
make them worktrees are the following properties:

- Firstly, they have to be marked `private: true`. We've designed this
  requirement because workspaces are a client-only feature. The remote
  registries (such as the npm registry) have no idea what a workspace is, nor
  should they do. In order to prevent accidental pushes and information leaks,
  we've decided that workspaces always had to be private.

- Secondly, they have to contain a `workspaces: Array<string>` property. This
  array must be an array of glob patterns that should be used to locate the
  workspaces that make up the worktree.

Note that because worktrees are defined with a `package.json` file, they also
are valid workspaces. This becomes useful in the following section.

## How to make a worktree elsewhere than the repository root?

Starting from Berry, Yarn now supports nested worktrees! You can now declare
multiple levels of worktrees, which might be useful especially when using git
features such as [submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules).

Nested worktrees have one important limitation: they must be linked to the
project root. In practice, it means that the nested worktree must itself be
defined as a workspace of the project root (or a workspace of a worktree that
itself is a workspace of the project root, etc).

## What does it mean to be a workspace?

Workspaces have two important characteristics:

- Only the dependencies depended upon by a workspace can be accessed. Said
  another way, we strictly enforce your workspaces dependencies.

- If the package manager was to resolve a range that a workspace could satisfy,
  it will prefer the workspace over the remote resolution if possible.

When a workspace is used as a resolution target, its dependents becomes able to
directly require files from its true location on the disk (you can think of
them as pseudo-symlinks, even though we don't actually need symlinks anymore).

## Workspace ranges

Starting from Berry, Yarn now supports a new resolution protocol: `workspace:`.
When this protocol is used Yarn will always resolve to the local workspace
regardless of the provided range (unless multiple workspaces of the same name
exist in the same project, in which case the range will be used to disambiguate
them).

Using the workspace protocol is advised when depending upon packages that
aren't meant to be published since it will prevent the packages that depend on
them from accidentally using a version from the npm registry if the ranges
aren't properly kept in sync.
