const fs = require(`fs`);

// Makes it possible to access our dependencies
require(`../../../.pnp.js`).setup();

// Adds TS support to Node
require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

// Exposes the CLI version as like for the bundle
global.YARN_VERSION = require(`@yarnpkg/cli/package.json`).version;

// Inject the plugins in the runtime. With Webpack that would be through
// val-loader which would execute pluginConfiguration.raw.js, so in Node
// we need to do something similar and mutate the require cache.
const PLUGIN_CONFIG_MODULE = `./tools/getPluginConfiguration.ts`;
require.cache[require.resolve(PLUGIN_CONFIG_MODULE)] = {exports: {getPluginConfiguration}};

module.exports = require(`./cli`);

function getPluginConfiguration() {
  const folders = fs.readdirSync(`${__dirname}/../../`);

  const pluginFolders = folders.filter(folder => {
    return folder.startsWith(`plugin-`);
  });

  // Note that we don't need to populate the `modules` field, because the
  // plugins will be loaded without being transformed by the builder wrapper,
  // so they will simply access their own set of dependencies.
  const pluginConfiguration = {
    plugins: new Set(),
    modules: new Map(),
  };

  for (const folder of pluginFolders) {
    pluginConfiguration.plugins.add(`@yarnpkg/${folder}`);
    pluginConfiguration.modules.set(`@yarnpkg/${folder}`, require(`../../${folder}`));
  }

  return pluginConfiguration;
}
