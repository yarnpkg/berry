import type {Options as MDXLoaderOptions, MDXOptions} from '@docusaurus/mdx-loader';
import type {LoadContext, Plugin}                     from '@docusaurus/types';
import {createRequire}                                from 'node:module';
import path                                           from 'node:path';

const webpack = createRequire(require.resolve(`@docusaurus/core/package.json`))(`webpack`);

export type Options = {
  changelog: Partial<MDXOptions>;
};

const plugin = async function(context: LoadContext, options: Options): Promise<Plugin> {
  return {
    name: `docusaurus-plugin-yarn-webpack-config`,
    configureWebpack(config, isServer, utils) {
      return {
        module: {
          rules: [
            {
              test: /\.term\.dat$/,
              use: [require.resolve(`../../webpack/ansi-loader.js`)],
            },
            {
              test: /\.mdx?$/,
              include: require.resolve(`@yarnpkg/monorepo/CHANGELOG.md`),
              use: [
                utils.getJSLoader({isServer}),
                {
                  loader: require.resolve(`@docusaurus/mdx-loader`),
                  options: {
                    admonitions: true,
                    siteDir: context.siteDir,
                    staticDirs: context.siteConfig.staticDirectories.map(dir => path.resolve(context.siteDir, dir)),
                    isMDXPartial: () => true,
                    isMDXPartialFrontMatterWarningDisabled: true,
                    markdownConfig: context.siteConfig.markdown,
                    ...options.changelog,
                  } satisfies MDXLoaderOptions,
                },
              ],
            },
          ],
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
