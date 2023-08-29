const fs = require(`fs`);
const micromatch = require(`micromatch`);
const path = require(`path`);
const semver = require(`semver`);

const {version} = require(`@yarnpkg/cli/package.json`);

// Exposes the CLI version as like for the bundle
global.YARN_VERSION = semver.prerelease(version) !== null
  ? `${version}.dev`
  : `${version}-dev`;

const PACKAGES = path.normalize(`${__dirname}/../packages`);

const PLUGIN_CONFIGURATION_MODULE = require.resolve(`${PACKAGES}/yarnpkg-cli/sources/tools/getPluginConfiguration.ts`);
const DYNAMIC_LIBS_MODULE = require.resolve(`${PACKAGES}/yarnpkg-cli/sources/tools/getDynamicLibs.ts`);

// Inject the plugins in the runtime. With Webpack that would be through
// val-loader which would execute pluginConfiguration.raw.js, so in Node
// we need to do something similar and mutate the require cache.
require.cache[PLUGIN_CONFIGURATION_MODULE] = {exports: {getPluginConfiguration}};

function getPluginConfiguration() {
  const folders = fs.readdirSync(PACKAGES);

  const pluginFolders = folders.filter(folder => {
    if (!folder.startsWith(`plugin-`))
      return false;

    if (process.env.BLACKLIST && micromatch.match([folder, folder.replace(`plugin-`, ``)], process.env.BLACKLIST).length > 0) {
      console.warn(`Disabled blacklisted plugin ${folder}`);
      return false;
    }

    let isRequirable;
    try {
      require(`${PACKAGES}/${folder}`);
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
    pluginConfiguration.modules.set(`@yarnpkg/${folder}`, require(`${PACKAGES}/${folder}`));
  }

  const {getDynamicLibs} = require(DYNAMIC_LIBS_MODULE);
  for (const [name, module] of getDynamicLibs())
    pluginConfiguration.modules.set(name, module);

  return pluginConfiguration;
}
