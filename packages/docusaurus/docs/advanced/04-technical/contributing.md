---
category: advanced
slug: /advanced/contributing
title: "Contributing"
description: Yarn's contributing guide.
---

Thanks for being here! Yarn gives a lot of importance to being a community project, and we rely on your help as much as you rely on ours. In order to help you help us, we've invested in an infra and documentation that should make contributing to Yarn very easy. If you have any feedback on what we could improve, please open an issue to discuss it!

## Opening an issue

Issues have to follow the issue template. Make sure to follow everything, with a special attention for the reproduction. If we can't reproduce your problem, we won't solve it.

## How can you help?

- Review our documentation! We often aren't native english speakers, and our grammar might be a bit off. Any help we can get that makes our documentation more digestible is appreciated!

- Talk about Yarn in your local meetups! Even our users aren't always aware of some of our features. Learn, then share your knowledge with your own circles!

- Help with our infra! There are always small improvements to do: run tests faster, uniformize the test names, improve the way our version numbers are setup, ...

- Write code! We have so many features we want to implement, and so little time to actually do it... Any help you can afford will be appreciated, and you will have the satisfaction to know that your work helped literally millions of developers!

## Finding work to do

It might be difficult to know where to start on a fresh codebase. To help a bit with this, we try to mark various issues with tags meant to highlight issues that we think don't require as much context as others:

- [Good First Issue](https://github.com/yarnpkg/berry/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) are typically self-contained features of a limited scope that are a good way to get some insight as to how Yarn works under the hood.

- [Help Wanted](https://github.com/yarnpkg/berry/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) are issues that don't require a lot of context but also have less impact than the ones who do, so no core maintainer has the bandwidth to work on them.

Finally, feel free to pop on our [Discord channel](https://discordapp.com/invite/yarnpkg) to ask for help and guidance. We're always happy to see new blood, and will help you our best to make your first open-source contribution a success!

## Writing your feature

Our repository is set up in such a way that calling `yarn` inside it will always use the TypeScript sources themselves - you don't have to rebuild anything for your changes to be applied there (we use `esbuild` to automatically transpile the files as we require them). The downside is that it's slower than the regular Yarn, but the improved developer experience is well worth it.

```bash
yarn install # Will automatically pick up any changes you made to sources
```

## Testing your code

We currently have two testsuites, built for different purposes. The first one is unit tests and can be triggered by running the following command from anywhere within the repository:

```bash
yarn test:unit
```

While various subcomponents that have a strict JS interface contract are tested via unit tests (for example the portable shell library, or the various util libraries we ship), Yarn as a whole relies on integration tests. Being much closer to what our users experience, they give us a higher confidence when refactoring the application that everything will work according to plan. Those tests can be triggered by running the following command (again, from anywhere within the repository):

```bash
yarn build:cli
yarn test:integration
```

Note that because we want to avoid adding the `esbuild` overhead to each Yarn call the CLI will need to be prebuilt for the integration tests to run - that's what the `yarn build:cli` command is for. This unfortunately means that you will need to rebuild the CLI after each modification if you want the integration tests to pick up your changes.

Both unit tests and integration tests use Jest, which means that you can filter the tests you want to run by using the `-t` flag (or simply the file path):

```bash
yarn test:unit yarnpkg-shell
yarn test:integration -t 'it should correctly install a single dependency that contains no sub-dependencies'
```

Should you need to write a test (and you certainly will if you add a feature or fix a bug 😉), they are located in the following directories:

- **Unit tests:** [`packages/*/tests`](https://github.com/search?utf8=%E2%9C%93&q=repo%3Ayarnpkg%2Fberry+filename%3Atest.ts+language%3ATypeScript+language%3ATypeScript&type=Code&ref=advsearch&l=TypeScript&l=TypeScript)
- **Integration tests:** [`packages/acceptance-tests/pkg-test-specs/sources`](https://github.com/yarnpkg/berry/tree/master/packages/acceptance-tests/pkg-tests-specs/sources)

The `makeTemporaryEnv` utility generates a very basic temporary environment just for the context of your test. The first parameter will be used to generate a `package.json` file, the second to generate a `.yarnrc.yml` file, and the third is the callback that will be run once the temporary environment has been created.

## Formatting your code

Before submitting your code for review, please make sure your code is properly formatted by using the following command from anywhere within the repository:

```bash
yarn test:lint
```

We use ESLint to check this, so using the `--fix` flag will cause ESLint to attempt to automatically correct most errors that might be left in your code:

```bash
yarn test:lint --fix
```

## Checking Constraints

We use [constraints](/features/constraints) to enforce various rules across the repository. They are declared inside the [`constraints.pro` file](https://github.com/yarnpkg/berry/blob/master/constraints.pro) and their purposes are documented with comments.

Constraints can be checked with `yarn constraints`, and fixed with `yarn constraints --fix`. Generally speaking:

- Workspaces must not depend on conflicting ranges of dependencies. Use the `-i,--interactive` flag and select "Reuse" when installing dependencies and you shouldn't ever have to deal with this rule.

- Workspaces must not depend on non-workspace ranges of available workspaces. Use the `-i,--interactive` flag and select "Reuse" or "Attach" when installing dependencies and you shouldn't ever have to deal with this rule.

- Workspaces that are part of the standard bundle or plugins must have specific build scripts. The ones that aren't, must be declared inside the `constraints.pro` file with `inline_compile`.

- Workspaces must point our repository through the `repository` field.

## Preparing your PR to be released

In order to track which packages need to be released, we use the workflow described in the [following document](/features/release-workflow). To summarize, you must run `yarn version check --interactive` on each PR you make, and select which packages should be released again for your changes to be effective (and to which version), if any.

You can check if you've set everything correctly with `yarn version check`.

If you expect a package to have to be released again but Yarn doesn't offer you this choice, first check whether the name of your local branch is `master`. If that's the case, Yarn might not be able to detect your changes (since it will do it against `master`, which is yourself). Run the following commands:

```bash
git checkout -b my-feature
git checkout -
git reset --hard upstream/master
git checkout -
yarn version check --interactive
```

If it fails and you have no idea why, feel free to ping a maintainer and we'll do our best to help you.

**Note:** If you modify one of the [default plugins](https://github.com/yarnpkg/berry#default-plugins), you will also need to bump `@yarnpkg/cli`.

## Reviewing other PRs

You're welcome to leave comments if you spot glaring bugs, but do not approve PRs if you're not a member.
It's generally seen as [bad form](https://twitter.com/brian_d_vaughn/status/1224051534536667137) in the open source community.

## Writing documentation

We use [Docusaurus](https://docusaurus.io/docs) to generate HTML pages from [mdx](https://mdxjs.com/docs/) sources files. 

Our website is stored within the [`packages/docusaurus`](https://github.com/yarnpkg/berry/tree/master/packages/docusaurus) directory. You can change a page by modifying the corresponding `.mdx` file in the `docs` folder. For example, you'd edit this very page [here](https://github.com/yarnpkg/berry/blob/master/packages/docusaurus/docs/advanced/04-technical/contributing.md).

Then run the following command to spawn a local server and see your changes:

```bash
yarn start
```

Once you're happy with what the documentation looks like, just commit your local changes and open a PR. Netlify will pick up your changes and create a fresh preview for everyone to see:

![](https://user-images.githubusercontent.com/1037931/61949789-3cc09300-afac-11e9-9817-89e97771a4e1.png)

## Profiling

Run the following command to generate an unminified bundle:

```bash
yarn build:cli --no-minify
```

Use a profiler on the generated bundle at `packages/yarnpkg-cli/bundles/yarn.js`. Here is an example which uses the Node.js built-in profiler:

```bash
YARN_IGNORE_PATH=1 node --prof packages/yarnpkg-cli/bundles/yarn.js
```
