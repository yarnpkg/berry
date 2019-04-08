---
category: advanced
path: /advanced/contributing
title: "Contributing"
---

Thanks for being here! Yarn gives a lot of importance to being a community project, and we rely on your help as much as you rely on ours. In order to help you help us we've invested in an infra and documentation that should make contributing to Yarn very easy. If you have any feedback on what we could improve, please open an issue to discuss it!

## Building the bundle

The standard bundle is built using the following command from anywhere in the repository:

```
$> yarn build:cli
```

The standard bundle uses a predefined set of plugins defined in [`packages/berry-cli/package.json`](https://github.com/yarnpkg/berry/blob/master/packages/berry-cli/package.json#L43). If your PR aims to add a new plugin to the standard build you'll need to add it there (note that this decision should be left to core maintainers - please don't modify this settings yourself).

For development purposes, you can build your plugin as part of your local bundle by using the `--plugin` option in the command line:

```
$> yarn build:cli --plugin @berry/typescript
```

## Testing your code

We currently have two testsuites, built for different purposes. The first one are unit tests and can be triggered by running the following command from anywhere within the repository:

```
$> yarn test:unit
```

Those unit tests can typically be found in the `packages/*/tests` directory.

While various subcomponents are tested via unit tests (for example the portable shell library), Yarn itself isn't tested through unit tests - we instead rely on integration tests which are much closer from our users setup. Those tests can be triggered through the following command (again, from anywhere within the repository):

```
$> yarn test:integration
```

In both cases the underlying framework we use is Jest, which means that you can filter the tests you want to run by using the `-t` flag (or simply the file path):

```
$> yarn test:unit berry-shell
$> yarn test:integration -t 'it should correctly install a single dependency that contains no sub-dependencies'
```

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
