const path = require('path');

// Makes it possible to access our dependencies
require(`../../../.pnp.js`).setup();

// Adds TS support to Node
require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

// Exposes the CLI version as like for the bundle
global.YARN_VERSION = require('@yarnpkg/cli/package.json').version;

// Finds the plugins
const dynamicLibs = require('@yarnpkg/builder/sources/data/dynamicLibs').dynamicLibs;
const plugins = require('@yarnpkg/builder/sources/tools/findPlugins.ts').findPlugins({
  basedir: path.dirname(require.resolve(`@yarnpkg/cli/package.json`)),
  plugins: findCustomPlugins(),
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

// Helper function that takes a semicolon-separated list of plugin names and
// resolves them. Non-builtin plugins can be compiled at runtime using their
// path instead of their name: `DEV=/path/to/plugin yarn`
function findCustomPlugins() {
  const devspec = process.env.DEV || ``;
  const plugins = [];

  for (const ref of devspec.split(`;`)) {
    let plugin = null;
    try {
      plugin = require.resolve(ref);
    } catch {}

    if (plugin !== null) {
      plugins.push(plugin);
    }
  }

  return plugins;
};
