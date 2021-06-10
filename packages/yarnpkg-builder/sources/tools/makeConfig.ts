import {npath, ppath, Filename, xfs} from '@yarnpkg/fslib';
import ForkTsCheckerWebpackPlugin    from 'fork-ts-checker-webpack-plugin';
import tsLoader                      from 'ts-loader';
import merge                         from 'webpack-merge';
import webpack                       from 'webpack';

export type WebpackPlugin =
  | ((this: webpack.Compiler, compiler: webpack.Compiler) => void)
  | webpack.WebpackPluginInstance;

const identity = <T>(value: T) => value;

// fork-ts-checker-webpack-plugin doesn't search
// for tsconfig.json files outside process.cwd() :(
export function findTsconfig() {
  let nextTsContextRoot = process.cwd();
  let currTsContextRoot = null;

  while (nextTsContextRoot !== currTsContextRoot) {
    currTsContextRoot = nextTsContextRoot;
    nextTsContextRoot = npath.dirname(currTsContextRoot);

    if (xfs.existsSync(ppath.join(npath.toPortablePath(currTsContextRoot), `tsconfig.json` as Filename))) {
      break;
    }
  }

  if (nextTsContextRoot === currTsContextRoot)
    throw new Error(`No tsconfig.json files could be found`);

  return npath.join(currTsContextRoot, `tsconfig.json`);
}

// We don't want to add the BuildPlugin outside of our infra.
function getBuildPlugin() {
  if (!process.env.BUILD_MONITORING_ENABLED)
    return [];


  const BuildPlugin = require(`@datadog/build-plugin/dist/webpack`).BuildPlugin;
  return [new BuildPlugin({
    context: npath.join(process.cwd(), `../..`),
    datadog: {
      endPoint: `app.datadoghq.eu`,
      apiKey: process.env.DD_API_KEY,
      prefix: `webpack`,
      tags: [
        `branchname:${process.env.GITHUB_REF || `branch`}`,
        `sha:${process.env.GITHUB_SHA || `local`}`,
        `jobname:${process.env.GITHUB_EVENT_NAME || `job`}`,
        `ci:${process.env.CI ? 1 : 0}`,
      ],
    },
  })];
}

export const makeConfig = (config: webpack.Configuration): webpack.Configuration => merge(identity<webpack.Configuration>({
  mode: `none`,
  devtool: false,

  target: `node16`,

  node: {
    __dirname: false,
    __filename: false,
  },

  output: {
    libraryTarget: `commonjs2`,
  },

  resolve: {
    extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],
  },

  module: {
    rules: [{
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    }, {
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: [{
        loader: require.resolve(`babel-loader`),
      }, {
        loader: require.resolve(`ts-loader`),
        options: identity<Partial<tsLoader.Options>>({
          compilerOptions: {
            declaration: false,
            module: `ESNext` as any,
            moduleResolution: `node` as any,
          },
          onlyCompileBundledFiles: true,
          transpileOnly: true,
        }),
      }],
    }],
  },

  externals: {
    // Both of those are native dependencies of text-buffer we can't bundle
    [`fs-admin`]: `{}`,
    [`pathwatcher`]: `{}`,
  },

  plugins: [
    ...getBuildPlugin(),
    new webpack.IgnorePlugin({
      resourceRegExp: /^encoding$/,
      contextRegExp: /node-fetch/,
    }),
    new webpack.DefinePlugin({[`IS_WEBPACK`]: `true`}),
    new webpack.optimize.LimitChunkCountPlugin({maxChunks: 1}),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: findTsconfig(),
      },
    }),
  ],
}), config);
