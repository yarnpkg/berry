const {build} = require(`esbuild`);

const pnpapi = require(`pnpapi`);
const fs = require(`fs`);

const pnpPlugin = {
  name: `pnp-plugin`,
  setup(build) {
    build.onResolve({filter: /.*/}, args => {
      const path = pnpapi.resolveRequest(args.path, args.importer, {
        considerBuiltins: true,
        extensions: [`.js`, `.jsx`, `.ts`, `.tsx`, `.json`],
      });

      if (path !== null) {
        return {namespace: `pnp`, path};
      } else {
        return {external: true};
      }
    });

    build.onLoad({filter: /.*/, namespace: `pnp`}, async args => ({
      contents: await fs.promises.readFile(args.path, `utf8`),
      loader: `default`,
    }));
  },
};

const plugins = [
  `@yarnpkg/plugin-essentials`,
  `@yarnpkg/plugin-compat`,
  `@yarnpkg/plugin-dlx`,
  `@yarnpkg/plugin-file`,
  `@yarnpkg/plugin-git`,
  `@yarnpkg/plugin-github`,
  `@yarnpkg/plugin-http`,
  `@yarnpkg/plugin-init`,
  `@yarnpkg/plugin-link`,
  `@yarnpkg/plugin-node-modules`,
  `@yarnpkg/plugin-npm`,
  `@yarnpkg/plugin-npm-cli`,
  `@yarnpkg/plugin-pack`,
  `@yarnpkg/plugin-patch`,
  `@yarnpkg/plugin-pnp`,
];

const modules = [
  ...plugins,
  `@yarnpkg/cli`,
  `@yarnpkg/core`,
  `@yarnpkg/fslib`,
  `@yarnpkg/libzip`,
  `@yarnpkg/parsers`,
  `@yarnpkg/shell`,
  `clipanion`,
  `semver`,
  `yup`,
];

const valLoad = (p, values) => {
  const fn = require(p.replace(/.ts$/, `.val.js`));
  return fn(values).code;
};

const valLoader = {
  name: `val-loader`,
  setup(build) {
    build.onLoad({filter: /\/getPluginConfiguration\.ts$/}, async args => ({
      contents: valLoad(args.path, {modules, plugins}),
      loader: `default`,
    }));
  },
};

build({
  entryPoints: [`packages/yarnpkg-cli/sources/cli.ts`],
  bundle: true,
  outfile: `out.js`,
  plugins: [valLoader, pnpPlugin],
}).catch(err => {
  console.log(err);
  process.exit(1);
});
