---
category: features
path: /features/release-workflow
title: "Release Workflow"
---

A hard task when working in a monorepo, and in particular when managing multiple packages, is to figure out which packages should be bumped when doing a new release. Yarn offers a few tools that aim to make this workflow easier without need for third-party software, althought it's possible to leverage those tools and build more integrated workflows.

## Auto-updated dependencies

When running the `yarn version` command to upgrade the version of a workspace, every other workspace that depend on the first one through a basic semver ranges (`^x.y.z`, `~x.y.z`, ...) will get auto-updated to reference the new version. For example, let's say we have the following workspaces:

```
/packages/common (1.0.0)
/packages/server (depends on common@^1.0.0)
/packages/client (depends on common@^1.0.0)
```

In pre-2.0, upgrading `common` would have required you to run the command there, then go into each of `server` and `client` to manually upgrade their dependencies to reference the new version. But not anymore! If we run `yarn version 1.1.1` into `common`, the following changes will be applied:

```
/packages/common (1.1.1)
/packages/server (depends on common@^1.1.1)
/packages/client (depends on common@^1.1.1)
```

Of course it's not that important when the packages from the monorepo are always meant to be used as part of the monorepo, but it becomes much more interesting when you work with multiple packages meant to be published. Had you forgotten to bump the referenced range of either of your dependent packages, your users would have potentially downloaded an old version of `common` which wouldn't have been compatible with the newer one.

## Deferred versioning

Starting from the 2.0, the `yarn version` command now accepts a new flag: `--deferred`. When set, this flag will cause the command to not directly change the `version` field of the local manifest, but instead create a new field called `nextVersion`. For example, the following:

```bash
yarn version 1.0.0
yarn version minor --deferred
```

Would generate the following field:

```json
{
  "version": "1.0.0",
  "nextVersion": {
    "semver": "1.1.0",
    "nonce": "102039092"
  }
}
```

One question you might have is: why? Why does it matter? To answer it, let's take the case of a successful open-source project which receives many contributions. Users work on various features, which you merge, and every once in a while you make a release for everything that got modified.

But now the problem is: how do you choose which packages to bump? Some tools offer to detect it based on the commit messages, but that implies that a specific style of commit message must be followed - and it causes ambiguities when multiple packages are modified in a single commit with various degrees of severity.

What `--deferred` offers, instead, is to let your users (and reviewers) decide when should a package be bumped. By using this flag, they're essentially telling Yarn: "at some point, I'll need to bump this package by at least a minor". Then once all the changes have been made, once all the pull requests have been merged, all that remains is to run `yarn version apply` to simultaneously update the version numbers of all the packages that were scheduled for a bump.

## Ensuring that versions are bumped (CI)

One problem with the `--deferred` flag, however, is that it becomes impossible to distinguish whether a PR bumped a package via a redundant strategy (for example when merging two minor features for the same release), or whether the PR author simply forgot to run the command on the affected package.

To solve this problem in an automated way, the `yarn version check` command appeared. When run, this command will figure out which packages changed and whether they received a version bump. If they didn't, an error will be thrown and assuming to integrate this into a CI system the PR author will be asked to be explicit about whether their changes should cause any package to be bumped.

Even better, `yarn version check` also works through transitive dependencies. So going back on our past example, should you modify your `common` package, running `yarn version check` will ask you to explicitly bump any non-private package that would happen to depend on it. Private packages get a pass because they're assumed to only work within the context of your repository, and thus don't need to have their version bumped.

Some changes don't require any version bump, of course! For those, just run `yarn version decline --deferred` and Yarn will take care of the rest.

> **How does it work?**
>
> You might have seen in the previous section this interesting `nonce` field. The nonce is used to mark whether a package received an explicit version bump or not. When running `yarn version check`, Yarn checks whether each workspace that got modified lists a new nonce compared to master. If they don't, it will recommand you to run `yarn version ... --deferred`, which will generate a new nonce regardless of whether a version bump would be redundant or not.
