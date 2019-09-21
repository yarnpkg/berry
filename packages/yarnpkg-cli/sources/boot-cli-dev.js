const path = require('path');
require('../../../.pnp.js').setup();

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);
global.YARN_VERSION = require('@yarnpkg/core').version;
const dynamicLibs = require('@yarnpkg/builder/sources/data/dynamicLibs').dynamicLibs;
const plugins = require('@yarnpkg/builder/sources/tools/findPlugins.ts').findPlugins({basedir: path.dirname(require.resolve(`@yarnpkg/cli/package.json`)), plugins: []});

const PLUGIN_CONFIG_MODULE = './pluginConfiguration.raw.js';
require(PLUGIN_CONFIG_MODULE);
require.cache[require.resolve(PLUGIN_CONFIG_MODULE)].exports = {
  modules: Array.from(dynamicLibs).concat(plugins).reduce((acc, module) => {
    acc.set(module, require(module));
    return acc;
  }, new Map()),
  plugins: new Set(plugins),
};

module.exports = require(`./cli`);
