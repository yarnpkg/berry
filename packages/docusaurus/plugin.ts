import type {PluginModule} from '@docusaurus/types';
import {createRequire}     from 'node:module';
import path                from 'node:path';

const webpack = createRequire(require.resolve(`@docusaurus/core/package.json`))(`webpack`);

const plugin: PluginModule = async function() {
  return {
    name: `docusaurus-yarn-plugin`,
    configureWebpack() {
      return {
        module: {
          rules: [{
            test: /\.term\.dat$/,
            use: [require.resolve(`./src/webpack/ansi-loader.js`)],
          }],
        },
        resolve: {
          fallback: {
            fs: false,
            module: false,
            buffer: false,
            os: require.resolve(`os-browserify`),
            path: require.resolve(`path-browserify`),
          },
          alias: {
            '@mdx-js/react': require.resolve(`@mdx-js/react`),
            react: path.resolve(require.resolve(`react/package.json`), `..`),
          },
        },
        plugins: [
          new webpack.DefinePlugin({
            [`process.env`]: JSON.stringify({
              NODE_ENV: `development`,
            }),
            [`process.platform`]: JSON.stringify(`browser`),
            [`process.versions`]: JSON.stringify({
              node: `18.0.0`,
            }),
          }),
        ],
      };
    },
  };
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
