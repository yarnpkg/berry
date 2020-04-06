---
category: advanced
path: /advanced/qa
title: "Questions & Answers"
---

```toc
# This code block gets replaced with the Table of Contents
```

## Which files should be gitignored?

If you're using Zero-Installs:

```gitignore
.yarn/*
!.yarn/cache
!.yarn/releases
!.yarn/plugins
```

If you're not using Zero-Installs:

```gitignore
.yarn/*
!.yarn/releases
!.yarn/plugins
.pnp.*
```

### Details

- `.yarn/unplugged` and `.yarn/build-state.yml` should likely always be ignored since they typically hold machine-specific build artifacts. Ignoring them might however prevent [Zero-Installs](https://yarnpkg.com/features/zero-installs) from working (to prevent this, set [`enableScripts`](/configuration/yarnrc#enableScripts) to `false`).

- `.yarn/cache` and `.pnp.*` may be safely ignored, but you'll need to run `yarn install` to regenerate them between each branch switch - which would be optional otherwise, cf [Zero-Installs](/features/zero-installs).

- `.yarn/plugins` and `.yarn/releases` contain the Yarn releases used in the current repository (as defined by [`yarn set version`](/cli/set/version)). You will want to keep them versioned (this prevents potential issues if, say, two engineers use different Yarn versions with different features).

- `.yarn/versions` is used by the [version plugin](/features/release-workflow) to store the package release definitions. You will want to keep it within your repository.

- `.yarn/install-state.tgz` is an optimization file that you shouldn't have to ever commit. It simply stores the exact state of your project so that the next commands can boot without having to resolve your workspaces again.

- `yarn.lock` should always be stored within your repository ([even if you develop a library](#should-lockfiles-be-committed-to-the-repository)).

- `.yarnrc.yml` (and its older counterpart, `.yarnrc`) are configuration files. They should always be stored in your project.

## Should lockfiles be committed to the repository?

**Yes.**

Lockfiles are meant to always be stored along with your project sources - and this regardless of whether you're writing a standalone application or a distributed library.

One persisting argument against checking-in the lockfile in the repository is about being made aware of potential problems against the latest versions of the library. People saying this argue that the lockfile being present prevents contributors from seeing such issues, as all dependencies are locked and appear fine until a consumer install the library and uses more recent (and incompatible) dependencies.

Although tempting, this reasoning has a fatal flaw: removing the lockfile from the repository doesn't prevent this problem from happening. Contributors won't test against new versions unless they run an install, so older projects may never even notice such incompatibilities. Then, years later, users that want to work on an old project won't even be able to install it because it's latest known good state didn't get checked-in. Even without going all the way to "years later", new contributors will always have to ponder whether things broke because of their changes or because of an incompatible dependency - decreasing the amount of contributions you'll receive.

Lockfiles should **always** be kept within the repository. Continuous integration testing is a good idea, but should be left to continuous integration systems. For example, Yarn itself runs [daily tests](https://github.com/yarnpkg/berry#current-status) against the latest versions of major open-source frameworks and tools. [Dependabot](https://dependabot.com/#how-it-works) is also a good tool that allows you to track your dependencies updates in a more integrated way.

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

## Is Yarn operated by Facebook?

**No.**

Despite the first version of Yarn having been implemented by [Sebastian McKenzie](https://twitter.com/sebmck) while working at Facebook, the initial design received feedbacks from various other companies (such as [Tilde](https://www.tilde.io) via [Yehuda Katz](https://yehudakatz.com/2016/10/11/im-excited-to-work-on-yarn-the-new-js-package-manager-2/)) and the project was put into its own [GitHub organization](https://github.com/yarnpkg). Facebook kept investing in it during the following years (mostly because it proved to be a critical part of the RN ecosystem) but major contributions came from the open-source too.

Nowadays the active development team is composed exclusively of people employed by non-founders companies. Facebook employees are of course still welcome to offer contributions to the project, but they would go through the same review process as any other.

## Why `registry.yarnpkg.com`? Does Facebook track us?

**No.**

When Yarn got created, the npm registry used to be served through Fastly. This was apparently affecting the install performances, so the initial team decided to partner with Cloudflare and setup a [reverse proxy](https://en.wikipedia.org/wiki/Reverse_proxy) that would simply better cache the requests before returning them. This setup didn't even have a backend.

At some point npm switched to Cloudflare as well, and we turned off the proxy to replace it by a [CNAME](https://en.wikipedia.org/wiki/CNAME_record) ([proof](https://toolbox.googleapps.com/apps/dig/#CNAME/registry.yarnpkg.com)). We still keep the hostname for reliability reasons - while it stands to reason that the Yarn domain name will keep being maintained for as long as Yarn is being used, the same isn't necessarily true of the npm domain name. That gives us the ability to redirect to a read-only copy of the registry should the primary source become unavailable.

To this day, no analytics are emitted by Yarn itself.

## Is Yarn faster than other package managers?

**Shrug 🤷‍♀️**

At the time Yarn got released Yarn was effectively much faster than some of its competitors. Unfortunately, we failed to highlight that performances weren't the main reason why we kept working on Yarn. Performances come and go, so while we were super fast it wasn't so much because we were doing something incredibly well, but rather that the competing implementations had a serious bug. When that bug got fixed, our miscommunication became more apparent as some people thought that Yarn was all about performances.

Put simply, our differences lie in our priorities. Different projects make different tradeoffs, and it's exactly what happens here. We prioritized workspaces because we felt like monorepos were providing significant value. We've spent significant resources pushing for Plug'n'Play (including through [dozens of contributions to third-party projects](https://github.com/pulls?utf8=%E2%9C%93&q=is%3Apr+author%3Aarcanis+archived%3Afalse+is%3Aclosed+pnp+-user%3Ayarnpkg+)) because we felt like this was important for the ecosystem. This is the main difference: we make our own informed decisions regarding the project roadmap.

Speed is relative and a temporary state. Processes, roadmaps and core values are what stick.
