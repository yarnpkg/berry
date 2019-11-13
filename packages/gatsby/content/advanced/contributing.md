---
category: advanced
path: /advanced/contributing
title: "Contributing"
---

Thanks for being here! Yarn gives a lot of importance to being a community project, and we rely on your help as much as you rely on ours. In order to help you help us we've invested in an infra and documentation that should make contributing to Yarn very easy. If you have any feedback on what we could improve, please open an issue to discuss it!

## Opening an issue

We have some rules regarding our issues. Please check [the following page](/advanced/sherlock) for more details.

## Finding work to do

It might be difficult to know where to start on a fresh codebase. To help a bit with this, we try to mark various issues with tags meant to highlight issues that we think don't require as much context as others:

  - [Good First Issue](https://github.com/yarnpkg/berry/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are typically self-contained features of a limited scope that are a good way to get some insight as to how Yarn works under the hood.

  - [Help Wanted](https://github.com/yarnpkg/berry/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) are issues that don't require a lot of context but also have less impact than the ones who do, so no core maintainer has the bandwidth to work on them.

Finally, feel free to pop on our [Discord channel](https://discordapp.com/invite/yarnpkg) to ask for help and guidance. We're always happy to see new blood, and will help you our best to make your first open-source contribution a success!

## Building the bundle

The standard bundle is built using the following command from anywhere in the repository:

```
$> yarn build:cli
```

Running this command will generate a file in `packages/yarnpkg-cli/bundles/berry.js`, and starting from now any Yarn command you'll run in this repository will always use your local build. In case it inadvertently becomes corrupted, just remove this file and run `build:cli` again to get a fresh one.

## Working on plugins

The standard bundle uses a predefined set of plugins defined in [`packages/yarnpkg-cli/package.json`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-cli/package.json#L64). If your PR aims to add a new plugin to the standard build you'll need to add it there (note that this decision should be left to the core maintainers - please don't modify this setting yourself).

For development purposes, you can build your plugin as part of your own local bundle by using the `--plugin` option in the command line:

```
$> yarn build:cli --plugin @yarnpkg/plugin-typescript
```

## Testing your code

We currently have two testsuites, built for different purposes. The first one are unit tests and can be triggered by running the following command from anywhere within the repository:

```
$> yarn test:unit
```

While various subcomponents that have a strict JS interface contract are tested via unit tests (for example the portable shell library, or the various util libraries we ship), Yarn as a whole relies on integration tests. Being much closer from what our users experience, they give us a higher confidence when refactoring the application that everything will work according to plan. Those tests can be triggered by running the following command (again, from anywhere within the repository):

```
$> yarn test:integration
```

In both cases the underlying framework we use is Jest, which means that you can filter the tests you want to run by using the `-t` flag (or simply the file path):

```
$> yarn test:unit berry-shell
$> yarn test:integration -t 'it should correctly install a single dependency that contains no sub-dependencies'
```

Should you need to write a test (and you will 😉), they are located in the following directories:

  - **Unit tests:** [`packages/*/tests`](https://github.com/search?utf8=%E2%9C%93&q=repo%3Ayarnpkg%2Fberry+filename%3Atest.ts+language%3ATypeScript+language%3ATypeScript&type=Code&ref=advsearch&l=TypeScript&l=TypeScript)
  - **Integration tests:** [`packages/acceptance-tests/pkg-test-specs/sources`](https://github.com/yarnpkg/berry/tree/master/packages/acceptance-tests/pkg-tests-specs/sources)

Don't forget that your PR will require all the tests to pass before being merged!

## Formatting your code

Before submitting your code for review, please make sure your code is properly formatted by using the following command from anywhere within the repository:

```
$> yarn test:lint
```

We use ESLint to check this, so using the `--fix` flag will cause ESLint to attempt to automatically correct most errors that might be left in your code:

```
$> yarn test:lint --fix
```

## Preparing your PR to be released

In order to track which packages need to be released we use the workflow described in the [following document](https://next.yarnpkg.com/advanced/managing-releases). To summarize, you must run `yarn version check --interactive` on each PR you make, and select which packages should be released again for your changes to be effective (and to which version), if any.

If you expect a package to have to be released again but Yarn doesn't offer you this choice, first check whether the name of your local branch is `master`. If that's the case, Yarn might not be able to detect your changes (since it will do it against `master`, which is yourself). Run the following commands:

```
git checkout -b my-feature
git checkout -
git reset --hard upstream/master
git checkout -
yarn version check --interactive
```

If it fails and you have no idea why, feel free to ping a maintainer and we'll do our best to help you.

## Writing documentation

Our website is stored within the [`packages/gatsby`](https://github.com/yarnpkg/berry/tree/master/packages/gatsby) directory. *Do not manually edit the html files in the `docs` folder!* Instead, just make your changes in the Gatsby directory (for example you'd edit this very page [here](https://github.com/yarnpkg/berry/blob/master/packages/gatsby/content/advanced/plugin-tutorial.md)), then run the following command to spawn a local server and see your changes:

```
$> yarn develop
```

Once you're happy with what the documentation looks like, just commit your local changes and open a PR. Netlify will pick up your changes and spawn a fresh preview for everyone to see:

![](https://user-images.githubusercontent.com/1037931/61949789-3cc09300-afac-11e9-9817-89e97771a4e1.png)

Once everything is green and a maintainer has reviewed your changes, we'll merge them and a bot will automatically trigger a rebuild of the website and update the `docs` folder 🙂
