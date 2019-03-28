const {clipanion} = require(`clipanion`);
const {readFileSync} = require(`fs`);
const Module = require(`module`);

const basedir = process.cwd();
const findPlugins = require(`./find-plugins`);

const babelConfiguration = {
  extensions: [`.ts`, `.tsx`, `.js`, `.jsx`],
  ignore: [/\/node_modules\//, /\/libzip\.js$/],
  presets: [[require.resolve(`@babel/preset-env`), {targets: {node: true}}], [require.resolve(`@babel/preset-typescript`)]],
  plugins: [require.resolve(`@babel/plugin-proposal-class-properties`)],
};

clipanion
  .command(`[... rest] [--profile TYPE] [--plugin PLUGIN ...]`)
  .action(async ({profile, plugin, rest}) => {
    process.argv = [`berry`, ... rest];

    const plugins = findPlugins({basedir, profile, plugin});

    require(`@babel/register`)(babelConfiguration);

    for (const key of Object.keys(require.cache))
      delete require.cache[key];

    const mockHook = require.cache[require.resolve(`@berry/pnp/sources/hook-bundle.js`)] = new Module();
    mockHook.exports = readFileSync(`${process.cwd()}/lib/hook-bundle.js`, `utf8`);
  
    const mockPlugins = require.cache[require.resolve(`@berry/cli/sources/plugins-embed.js`)] = new Module();
    mockPlugins.exports = new Map(plugins.map(name => [name, require(name).default]));

    require(require.resolve(`@berry/cli/sources/index.ts`));
  });

clipanion
  .runExit(process.argv0, process.argv.slice(2));
