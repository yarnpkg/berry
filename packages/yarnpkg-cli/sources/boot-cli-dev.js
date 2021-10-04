const fs = require(`fs`);

// Makes it possible to access our dependencies
const pnpFile = `${__dirname}/../../../.pnp.cjs`;
if (fs.existsSync(pnpFile))
  require(pnpFile).setup();

// Adds TS support to Node
require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

// Exposes the CLI version as like for the bundle
global.YARN_VERSION = `${require(`@yarnpkg/cli/package.json`).version}.dev`;

// Inject the plugins in the runtime. With Webpack that would be through
// val-loader which would execute pluginConfiguration.raw.js, so in Node
// we need to do something similar and mutate the require cache.
const PLUGIN_CONFIG_MODULE = `./tools/getPluginConfiguration.ts`;
require.cache[require.resolve(PLUGIN_CONFIG_MODULE)] = {exports: {getPluginConfiguration}};

const micromatch = require(`micromatch`);

module.exports = require(`./cli`);

function getPluginConfiguration() {
  const folders = fs.readdirSync(`${__dirname}/../../`);

  const pluginFolders = folders.filter(folder => {
    if (!folder.startsWith(`plugin-`))
      return false;

    if (process.env.BLACKLIST && micromatch.match([folder, folder.replace(`plugin-`, ``)], process.env.BLACKLIST).length > 0) {
      console.warn(`Disabled blacklisted plugin ${folder}`);
      return false;
    }

    let isRequirable;
    try {
      require(`${__dirname}/../../${folder}`);
      isRequirable = true;
    } catch (e) {
      console.warn(`Disabled non-requirable plugin ${folder}: ${e.message}`);
      isRequirable = false;
    }
    return isRequirable;
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

  const {getDynamicLibs} = require(`./tools/getDynamicLibs`);
  for (const [name, module] of getDynamicLibs())
    pluginConfiguration.modules.set(name, module);

  return pluginConfiguration;
}
