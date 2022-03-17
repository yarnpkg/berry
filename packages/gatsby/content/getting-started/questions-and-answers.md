---
category: getting-started
path: /getting-started/qa
title: "Questions & Answers"
description: A list of answers to commonly asked questions.
---

```toc
# This code block gets replaced with the Table of Contents
```

## Why should you upgrade to Yarn Modern?

While the Yarn Classic line (1.x) remains a pillar of the JavaScript ecosystem, we recommend upgrading if possible. Why's that?

1. New features: On top of the features in Classic that you're already used to, you'll discover new features not found in Classic, including [`yarn dlx`](/cli/dlx), [builtin `patch:` protocol](https://github.com/yarnpkg/berry/tree/master/packages/plugin-patch), and more. Plus, new features can be, and are, added all the time through Modern's plugin system. Plugins extend Yarn's feature set with

2. Efficiency: Modern features new install strategies, leading to significantly smaller project sizes when compared to Classic. For example, under Modern's default configuration, the stock CRA artifacts are now only 45MB instead of 237MB. [Performance](https://p.datadoghq.eu/sb/d2wdprp9uki7gfks-c562c42f4dfd0ade4885690fa719c818) has improved as well, with most installs now only taking a few seconds to complete, even on extremely large projects. We even made it possible to reach [zero second installs](/features/zero-installs)!

3. Extensibility: Modern's architecture allows you to build your own features whenever you need to. No more being blocked as you wait for a feature to be released by the core team! In fact, many of Yarn's most popular features are implemented as plugins, including [changesets](/features/release-workflow), [constraints](/features/constraints), [workspaces](/cli/workspaces/foreach), and more. Focused workspaces, custom installs, project validation - all these and more are possible through the plugin system.

4. Stability: Modern builds on the years of experience spent maintaining Classic; it allowed us to finally fix longstanding design issues with how some features were implemented. Workspaces are now core components, the resolution pipeline has been streamlined, data structures are more efficient, and as a result, Modern is much less likely to suffer from incorrect assumptions and other design flaws.

5. Future-proof: A big reason why we invested in Modern was that we noticed how building new features on Classic was becoming difficult - each change lead to more and more unforeseen consequences. Modern's architecture corrects our past mistakes and was designed to allow us to build features at a much higher pace.

## How easy should you expect the migration from Classic to Modern to be?

Generally, a few main things will need to be taken care of:

1. The settings format changed. We don't read the `.npmrc` or `.yarnrc` files anymore. Instead, we read settings from the [`.yarnrc.yml` file](https://yarnpkg.com/configuration/yarnrc).

2. Some third-party packages don't list their dependencies properly and will need to be helped through the [`packageExtensions`](https://yarnpkg.com/configuration/yarnrc#packageExtensions) settings. You may not have noticed these kinds of dependency issues in the past, but Modern brings these kinds of pitfalls to your attention right away, giving you better insights into the packages you use.

3. Support for text editors is pretty good, but you'll need to run the one-time-setup listed in our [SDK documentation](https://yarnpkg.com/getting-started/editor-sdks).

4. Some tools (mostly React Native and Flow) don't support the Plug'n'Play install strategy and will require your project to use the `node_modules` install strategy by setting the [`nodeLinker`](https://yarnpkg.com/configuration/yarnrc#nodeLinker) setting to `node-modules`. TypeScript doesn't have this problem.

Most projects will only face those four problems, which can all be fixed in a good afternoon of work. For more detailed instructions, please see the detailed [migration guide](/getting-started/migration).

## Which files should be gitignored?

If you're using Zero-Installs:

```gitignore
.yarn/*
!.yarn/cache
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
```

If you're not using Zero-Installs:

```gitignore
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
```

If you're interested to know more about each of these files:

- `.yarn/cache` and `.pnp.*` may be safely ignored, but you'll need to run `yarn install` to regenerate them between each branch switch - which would be optional otherwise, cf [Zero-Installs](/features/zero-installs).

- `.yarn/install-state.gz` is an optimization file that you shouldn't ever have to commit to your repository. It stores the exact state of your project so that the next commands can boot without having to resolve your workspaces all over again.

- `.yarn/patches` contains the patch files generated with the [`yarn patch-commit`](/cli/patch-commit) command. You should commit these files to your repository since they are necessary to install your dependencies.

- `.yarn/plugins` and `.yarn/releases` contain the Yarn releases used in the current repository (as defined by [`yarn set version`](/cli/set/version)). You should commit these files to your repository as this will prevent potential issues if, for example, two engineers use different Yarn versions with different features.

- `.yarn/sdks` contains the editor SDKs generated by `@yarnpkg/sdks`. You can decide whether to commit these to your repository or not. If you don't commit them, you'll need to follow the editor procedure again on new clones. See [Editor SDKs](/getting-started/editor-sdks) for more details.

- The files in `.yarn/unplugged` should usually be ignored as they typically hold machine-specific build artifacts. However, not committing them may prevent [Zero-Installs](https://yarnpkg.com/features/zero-installs) from working as intended. In that case, you can resolve this issue by setting [`enableScripts`](/configuration/yarnrc#enableScripts) to `false`.

- `.yarn/versions` is used by the [version plugin](/features/release-workflow) to store the package release definitions. You should commit these files to your repository.

- `yarn.lock` should always be committed to your repository ([even if you develop a library](#should-lockfiles-be-committed-to-the-repository)).

- `.yarnrc.yml` (and its older counterpart, `.yarnrc`) are configuration files. You should always commit these files to your repository.

> **Tip:** You can also add a `.gitattributes` file to identify the release and plugin bundles as binary content. This way Git won't bother showing massive diffs when each time you subsequently add or update them:
>
> ```gitattributes
> /.yarn/releases/** binary
> /.yarn/plugins/** binary
> ```

## Does Yarn support ESM?

**Yes.**

First, remember that Yarn supports the [`node-modules` install strategy](https://yarnpkg.com/configuration/yarnrc#nodeLinker), which installs package exactly the same as, say, npm would. So if Yarn didn't support ESM, nothing would. If you hear someone say it doesn't, they actually mean "[Yarn PnP](https://yarnpkg.com/features/pnp) doesn't support ESM" - **except it does**, ever since the [3.1](https://dev.to/arcanis/yarn-31-corepack-esm-pnpm-optional-packages--3hak#esm-support).

To go into more detail, let's first talk about ESM. The ESM spec was drafted in ES2015. However, no engine implemented it straight away: at this time the spec was pretty much just a syntactic placeholder, with nothing concrete underneath. It was only in late 2019 that Node finally received support for native ESM, without requiring an experimental flag. But this support had one major caveat: **the ESM loaders weren't there**. Loaders are the things that allow projects to tell Node how to locate packages and modules on the disk. You probably know some of them: [`@babel/register`](https://babeljs.io/docs/en/babel-register#compiling-plugins-and-presets-on-the-fly), [`ts-node`](https://github.com/TypeStrong/ts-node/discussions/1321), [Jest's mocks](https://github.com/facebook/jest/issues/9430), [Electron](https://github.com/electron/electron/issues/21457), and many more.

Unlike CommonJS, the ESM module resolution pipeline was intended to be completely walled from the outside so that, for example, multiple threads could share the same resolver instance. It also meant that without official loader support, **it was impossible to support alternate resolution strategies**. Monkey-patching the resolution primitives wasn't viable anymore, so none of those projects could support ESM at all. It could only mean one thing: **ESM wasn't ready**. Yes, it was supported natively, but given it broke a sizeable part of the ecosystem with no alternative whatsoever, it couldn't be a reasonable standard - yet.

Fortunately, Node saw the issue, started to work on loaders, and shipped their first iteration. Fast forward to today, and while Node Loaders are still [a work in progress](https://nodejs.org/api/esm.html#loaders) (and have changed shape more than once, as highlighted by the"experimental" annotation), they have allowed us to draft the first implementation of an ESM-compatible PnP loader, which we shipped in 3.1. Strong off those learnings, we started to contribute to the Node Loaders working group, not only to help Yarn's use cases but also those of other projects that follow our lead.

Loaders aren't perfect yet, and until they are **ESM-only packages are not recommended**, but there's a way forward and as we work together we'll get there. We just have to be careful not to push people aside as we run towards our goal.

## Should lockfiles be committed to the repository?

**Yes.**

Lockfiles are meant to always be stored along with your project sources - and this regardless of whether you're writing a standalone application or a distributed library.

One persistent argument against checking-in the lockfile in the repository is about being made aware of potential problems against the latest versions of the library. People saying this argue that the lockfile being present prevents contributors from seeing such issues, as all dependencies are locked and appear fine until a consumer installs the library and uses more recent (and incompatible) dependencies.

Although compelling, this reasoning has a fatal flaw: removing the lockfile from the repository doesn't prevent this problem from happening. In particular:

- Active contributors won't get new versions unless they explicitly remove their install artifacts (`node_modules`), which may not happen often. Problematic dependency upgrades will thus be mainly discovered by new contributors, which doesn't make for a good first experience and may deter contributions.

- Even assuming you run fresh installs every week, your upgrades won't be easily reversible - once you test the most recent packages, you won't test against the less recent ones. The compatibility issues will still exist, they just will be against packages that used to work but that you don't test anymore. in other words, by always testing the most recent semver release, you won't see if you accidentally start relying on a feature that wasn't available before.

Of course these points are only part of the problem - the lack of lockfile also means that key state information are missing from the repository. When months later you or your contributors want to make a fix on one of your old projects you might not even be able to *build* it anymore, let alone improve it.

Lockfiles should **always** be kept within the repository. Continuous integration testing **is a good idea**, but should be left to continuous integration systems. For example, Yarn itself runs [daily tests](https://github.com/yarnpkg/berry#current-status) against the latest versions of major open-source frameworks and tools, which allows us to quickly spot any compatibility issue with the newest release, while still being guaranteed that every contributor will have a consistent experience working with the project. [Dependabot](https://dependabot.com/#how-it-works) and [Renovate](https://www.whitesourcesoftware.com/free-developer-tools/renovate) are also good tools that track your dependencies updates for you.

## How to share scripts between workspaces?

Little-known Yarn feature: any script with a colon in its name (`build:foo`) can be called from any workspace. Another little-known feature: `$INIT_CWD` will always point to the directory running the script. Put together, you can write scripts that can be reused this way:

```json
{
  "dependencies": {
    "typescript": "^3.8.0"
  },
  "scripts": {
    "g:tsc": "cd $INIT_CWD && tsc"
  }
}
```

Then, from any workspace that contains its own `tsconfig.json`, you'll be able to call TypeScript:

```json
{
  "scripts": {
    "build": "yarn g:tsc"
  }
}
```

or if you only want to use `tsc` from the root workspace:

```json
{
  "scripts": {
    "build": "run -T tsc"
  }
}
```

Should you want to run a script in the base of your project:

```json
{
  "scripts": {
    "build": "node ${PROJECT_CWD}/scripts/update-contributors.js"
  }
}
```

## Is Yarn operated by Facebook?

**No.**

Despite the first version of Yarn having been implemented by [Sebastian McKenzie](https://twitter.com/sebmck) while working at Facebook, the initial design received feedback from various other companies (such as [Tilde](https://www.tilde.io) via [Yehuda Katz](https://yehudakatz.com/2016/10/11/im-excited-to-work-on-yarn-the-new-js-package-manager-2/)) and the project was put into its own [GitHub organization](https://github.com/yarnpkg). Facebook kept investing in it during the following years (mostly because it proved to be a critical part of the React Native ecosystem) but major contributions came from the open-source community as well.

Nowadays, the active development team is composed exclusively of people employed by non-founders companies. Facebook employees are of course still welcome to offer contributions to the project, but all contributions, no matter who they're from, go through the same review process.

## Why `registry.yarnpkg.com`? Does Facebook track us?

**No.**

At the time Yarn was created, the npm registry had issues that negatively impacted install performance, so the initial team decided to partner with Cloudflare and set up a [reverse proxy](https://en.wikipedia.org/wiki/Reverse_proxy) that would better cache the requests before returning them. This setup didn't even have a backend on our side.

Eventually, npm resolved many of those issues, and we turned off the proxy to replace it by a [CNAME](https://en.wikipedia.org/wiki/CNAME_record) ([proof](https://toolbox.googleapps.com/apps/dig/#CNAME/registry.yarnpkg.com)). We still keep the hostname for because it gives us the ability to redirect to a read-only copy of the registry should the primary source become unavailable.

While we do gather some basic [client-side telemetry](/advanced/telemetry), no http logs can ever even reach the Yarn project infrastructure - and even less Facebook, which has no control over the project (see also, [Is Yarn operated by Facebook?](/getting-started/qa#is-yarn-operated-by-facebook)).

## Queries to `registry.yarnpkg.com` return a 404/500/...; is it down?

**No.**

As mentioned in the [previous section](#why-registryyarnpkgcom-does-facebook-track-us), the Yarn registry is just a CNAME to the npm registry. Since we don't even have a backend, any server error comes from the npm registry and thus should be reported to them and monitored on their [status page](https://status.npmjs.org/).

## Is Yarn faster than other package managers?

**Shrug 🤷‍♀️**

Yarn was much faster than some of its competitors when it was first released. Unfortunately, we failed to highlight that performance wasn't the main reason why we kept working on Yarn. Performance is an ongoing battle for most projects though, and Yarn's speed wasn't so much because we were doing something incredibly well, but rather the competing implementations had issues that seriously impacted their performance. As those issues were resolved, our miscommunication became more apparent as some people thought that Yarn was all about performances.

Put simply, different projects make different tradeoffs. We've spent significant resources pushing for Plug'n'Play (including through [dozens of contributions to third-party projects](https://github.com/pulls?utf8=%E2%9C%93&q=is%3Apr+author%3Aarcanis+archived%3Afalse+is%3Aclosed+pnp+-user%3Ayarnpkg+)) because we felt like this was important for the ecosystem. We prioritized workspaces because we felt that monorepos provided significant value. This is Yarn's main distinction: we make our own informed decisions regarding the project roadmap.

Speed is relative and a temporary state. Processes, roadmaps and core values are what stick.

## Why is TypeScript patched even if I don't use Plug'n'Play?

Given that PnP is a resolver standard different from Node, tools that reimplement the `require.resolve` API need to add some logic to account for the PnP resolution. While various projects did so (for example Webpack 5 now supports PnP out of the box), a few are still on the fence about it. In the case of TypeScript we started and keep maintaining a [pull request](https://github.com/microsoft/TypeScript/pull/35206), but the TypeScript team still has to accept it. In order to unblock our users, we made the decision to automatically apply this exact pull request to the downloaded TypeScript versions, using our new [`patch:` protocol](/features/protocols#patch).

Which now begs the question: why do we still apply this patch even when Plug'n'Play is disabled? The main reason is that Yarn intends to provide consistent behaviour. Some setups involve using the `node_modules` linker during development (to avoid having to set up their editor [SDKS](/getting-started/editor-sdks)) and PnP in production (for install speed). If we were to only apply the patches when PnP is enabled, then the package cache would be different, which would break immutable installs.

We *could have* potentially make it configurable through a switch, but in the end we decided it wasn't worth the extra configuration:

- The TypeScript patch is a no-op if PnP isn't enabled, so this shouldn't affect your workflow (if it does, please open an issue)
- We hope to eventually land this PR in TypeScript one day, so the more eyes we can get on it the more likely it will be that it will land
- Since Yarn 3+, failing builtin patches are simply ignored and fallback to the original sources.
