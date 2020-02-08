# @yarnpkg/doctor

A cli tool to help package maintainers support pnp.

## Usage

To check your package run:

`yarn dlx @yarnpkg/doctor ./package-dir`

You'll get a pretty output with all the warnings.

## Rules

- no unlisted dependencies
- no unmet peer dependencies
- no node_module strings
- no unqualified webpack loaders

### no unlisted dependencies

This rule warns when imported dependencies are not listed in a project/workspace's package.json.

Node allows you to import any package without having a version specified in your package.json. This can lead to subtle and hard to solve bugs. 

For example: 
1. Node might find a globally installed package and the project works on your machine. While other your colleagues might be missing the globally installed package or (worse) have an incompatible version installed.

2. Or Node might find a transitive dependency (dependency of a dependency) and use that. If you remove or upgrade that dependency and it affects the transitive dependency then it can trigger all sorts of bugs.

By making sure all dependencies are listed in the package.json pnp can make your project less brittle. 

### no unmet peer dependencies

This rule warns when a package has unmet peer dependencies.

Peer dependencies are useful for allowing package authors to delegate control of a dependency's version to the package user. When used correctly they prevent version conflicts and reduce bundle sizes.

Peer dependencies must be manually added to the package user's package.json. Because they responsibility of the package user they can be overlooked. 

This rule ensures that all peer dependencies are included and therefore installed for your project. 

### no node module strings

This rule warns when `node_modules` appears in strings or template literals.

If a string literal includes "node_modules" else it is likely a sign that the package is doing shady things with node_modules which would likely fail under PnP.

One of the big benefits of Plug-n-Play is that it does away with `node_modules` directories to achieve zero installs, increased stability and reliability. Therefore, resolutions that rely on the presence of a `node_modules` folder will fail.

Aside from satisfying Plug'n'Play requirements, resolving packages using `node_modules` this way is brittle and may result unpredictable packages versions and subtle bugs.

Examples of **incorrect** code for this rule:

```js
var module = require("../node_modules/lodash");
```

Examples of **correct** code for this rule:

```js
var foo = require("lodash"); // importing a module by its name
```

### no unqualified webpack config

This rule disallows referencing loaders or plugins in string literals in a `webpack.config.js` in a non-private package.

Ensures that third party tools (CRA, Next, Vue-cli, etc) resolve their own versions of loaders and presets.

When loaders and plugins are included as strings e.g `loader: 'file-loader'` in a `webpack.config.js` then Webpack will try to resolve it from the point of view of the project root. 

If the webpack config is located in a dependency, as with tools such as Create-React-App, Next.js and Gatsby, then Webpack might accidentally use an different hoisted version of a plugin. This can cause various weird bugs and crashes.

The third party tool should use `require.resolve('file-loader')` so that Webpack loads the plugin through an absolute path and it will use the loader/plugin it specifies in its own package.json.

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

* [Yarn 2 docs](https://yarnpkg.com)
* [Introduction to `plug-n-play`](https://yarnpkg.com/features/pnp)
