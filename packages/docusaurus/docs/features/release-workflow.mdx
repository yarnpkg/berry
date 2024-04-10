---
category: features
path: /features/release-workflow
title: "Release Workflow"
description: An in-depth guide to Yarn's release workflow which helps with managing versions across a monorepo.
---


:::info Experimental
This feature is still incubating, and we'll likely be improving it based on your feedback.
:::

When working with monorepos, a hard task often is to figure out which packages should receive a new version when starting a new release. Yarn offers a few tools that aim to make this workflow easier without the need for third-party tools (although it's possible you may prefer the workflow offered by different implementations, of course!).

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

Of course it's not that important when the packages from the monorepo are always meant to be used as part of the monorepo, but it becomes much more interesting when you work with multiple packages meant to be published. Had you forgotten to update the range of either of your dependent packages, your users would have potentially downloaded an old version of `common` which wouldn't have been compatible with the newer one.

## Deferred versioning

Starting from the 2.0, the `yarn version` command now accepts a new flag: `--deferred`. When set, this flag will cause the command to not immediately change the `version` field of the local manifest, but to instead internally record an entry stating that the current package will need to receive an upgrade during the next release cycle. For example, the following:

```
yarn version minor --deferred
```

Will not cause the `package.json` file to change! Instead, Yarn will create (or reuse, if you're inside a branch) a file within the `.yarn/versions` directory. This file will record the requested upgrade:

```yaml
releases:
  my-package@1.0.0: minor
```

Then later on, once you're ready, just run `yarn version apply`. Yarn will then locate all the upgrade records it previously saved, and apply them all at once (including by taking care of upgrading inter-dependencies as we saw).

## Checked-in deferred records

We've seen in the previous section that `yarn version patch` could store the future versions in an internal folder, `.yarn/versions`. But why is that? What good is it? To answer this question, consider a popular open-source project developed through a monorepo. This project receives many external pull requests, but they aren't released right away - they're often released as part of a batch. Every once in a while, the lead maintainer will take all the changes, convert them into new versions, and start the deployment.

Let's focus on the part where changes have to be converted into versions. How does that work? This isn't easy. Taking Lerna, for example (the most popular version management tool for monorepos), you have two solutions:

- With the fixed mode, all your packages have a single version. As such, they get upgraded all at once.

- With the independent mode, you get to chose a version for each package whose sources changed.

One critical problem remains, though: even if you use the independent mode, how will you know which packages are meant to be upgraded? And, just as critical, should they be patch releases? Minor releases? Hard to know - large projects can receive dozens of PRs a week, and keeping track of which units need to be released and to which version is a pretty difficult task.

With Yarn's workflow, however, this all becomes very easy! Since the upgrades are kept in a file, and since this file is magically bound to a Git branch, it simply becomes a matter of committing the release folder - all expected releases will then become part of the project history until comes the time of `yarn version apply` - then Yarn will consume all the individual records, merge them (so that a PR requiring a minor will have higher precedence than the PR requiring a patch), and apply them simultaneously.

As an added bonus, you'll even be able to review the package upgrades as part of the typical PR review! This will have the effect of delegating more power to your community while being able to ensure that everyone follows rules.

## Ensuring that versions are bumped (CI)

One problem with committing the deferred releases, however, is that it becomes important to make sure that the PRs you receive include the correct package release definitions. For example, you should be able to trust that the definition contains release strategies (patch, minor, major, ...) for each modified workspace.

To solve this problem in an automated way, the `yarn version check` command appeared. When run, this command will figure out which packages changed and whether they are listed in the release definition file. If they aren't, an error will be thrown and - assuming you integrate this into a CI system such as the GitHub Actions - the PR author will be asked to fill out the release definition file.

Writing this file can be tedious; fortunately `yarn version check` implements a very handy flag named `--interactive`. When set (`yarn version check --interactive`), Yarn will print a terminal interface that will summarize all the changed files, all the changed workspaces, all relevant dependent workspaces, and checkboxes for each entry allowing you to pick the release strategies you want to set for each workspace.

The [`changesetIgnorePatterns`](/configuration/yarnrc#changesetIgnorePatterns) configuration option can be used to ignore files when checking which files have changed. It is useful for excluding files that don't affect the release process (e.g. test files).

### Caveat

#### Commit history

The [version plugin](https://github.com/yarnpkg/berry/tree/master/packages/plugin-version) requires access to the commit history in order to be able to correctly infer which packages require release specifications. In particular, when using GitHub Actions with `actions/checkout@v2` or greater the default behavior is for Git to fetch just the version being checked, which would cause problems. To correct this, you will need to override the `fetch-depth` configuration value to fetch the whole commit history:

```yaml
- uses: actions/checkout@v2
  with:
    fetch-depth: 0
```
