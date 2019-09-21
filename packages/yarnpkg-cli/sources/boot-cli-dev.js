const path = require('path');

// Makes it possible to access our dependencies
require(`../../../.pnp.js`).setup();

// Adds TS support to Node
require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

// Exposes the CLI version as like for the bundle
global.YARN_VERSION = require('@yarnpkg/cli/package.json').version;

// Finds the plugins - only the builtin ones are supported in dev for now
const dynamicLibs = require('@yarnpkg/builder/sources/data/dynamicLibs').dynamicLibs;
const plugins = require('@yarnpkg/builder/sources/tools/findPlugins.ts').findPlugins({
  basedir: path.dirname(require.resolve(`@yarnpkg/cli/package.json`)),
  plugins: [],
});

// Inject the plugins in the runtime. With Webpack that would be through
// val-loader which would execute pluginConfiguration.raw.js, so in Node
// we need to do something similar and mutate the require cache.
const PLUGIN_CONFIG_MODULE = './pluginConfiguration.raw.js';
require.cache[require.resolve(PLUGIN_CONFIG_MODULE)] = {
  exports: {
    modules: new Map(Array.from(dynamicLibs).concat(plugins).map(module => [module, require(module)])),
    plugins: new Set(plugins),
  },
};

module.exports = require(`./cli`);
