# @yarnpkg/check

A cli tool to help package maintainers support pnp.

## Usage

To check your package run:

`yarn dlx @yarnpkg/check ./package-dir`

You'll get a pretty output with all the warnings.

## Rules

- no unlisted dependencies
- no unmet peer dependencies
- no node_module strings
- no unqualified webpack loaders

### no unlisted dependencies

Warn when imported dependencies are not listed in a project/workspace's package.json.

Node allows you to import any package without having a version specified in your package.json. This can lead to subtle and hard to solve bugs. 

For example: 
1. Node might find a globally installed package and the package works on your machine. Other members in your team might be missing the globally installed package or (often worse) have an incompatible version.

2. Or Node might find a transitive dependency (dependency of a dependency) and use that. If you remove or upgrade that dependency you're rolling the dice.

We can address these issues by making sure all dependencies are listed in the package.json. 

### no unmet peer dependencies

Warn when a package has unmet peer dependencies.

Peer dependencies are useful for allowing package authors to delegate control of a dependency's version to the package user. When used correctly they prevent version conflicts and reduce bundle sizes.

Peer dependencies must be manually added to the package user's package.json. Because they responsibility of the package user they can be overlooked. 

### no node module strings

Warn when `node_modules` in strings or template literals.

If a string literal includes "node_modules" else it is likely a sign that the package is doing shady things with node_modules which would likely fail under PnP.

One of the big benefits of Plug-n-Play is that it does away with `node_modules` directories to achieve zero installs, increased stability and reliability. Therefore, resolutions that rely on the presence of a `node_modules` will fail.

Aside from satisfying Plug'n'Play requirements, resolving packages using `node_modules` this way is brittle and may result unpredictable packages versions.

Examples of **incorrect** code for this rule:

```js
var module = require("../node_modules/lodash");
```

Examples of **correct** code for this rule:

```js
var foo = require("lodash"); // importing a module by its name
```

### no unqualified webpack config

This rule disallows using referencing loaders or plugins in string literals in a `webpack.config.js` in a non-private package.

Ensures that third party tools (CRA, Next, Vue-Cli, ...) resolve their own versions of loaders and presets.

When loaders and plugins are included as strings e.g `loader: 'file-loader'` in a `webpack.config.js` then Webpack will try to resolve it from the point of view of the project root. 

If the webpack config is located in a dependency, as with tools such as Create-React-App, Next.js and Gatsby, then Webpack might accidentally use an different hoisted version of a plugin. This can cause various weird bugs and crashes.

The tool should use `require.resolve('file-loader')` so that Webpack loads the plugin through an absolute path and it will use the loader/plugin it specifies in its own package.json.

Examples of **incorrect** code for this rule:

```js
const webpackConfig = {
  use: `ts-loader`,
};
```

Examples of **correct** code for this rule:

```js
const webpackConfig = {
  use: require.resolve(`ts-loader`),
};
```

This rule is a temporary measure to address this [issue](https://github.com/webpack/webpack/issues/9648)

## Further reading

* [Yarn 2 docs](https://next.yarnpkg.com)
* [Introduction to `plug-n-play`](https://next.yarnpkg.com/features/pnp)
