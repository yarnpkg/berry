import {npath, ppath, Filename, xfs} from '@yarnpkg/fslib';
import ForkTsCheckerWebpackPlugin    from 'fork-ts-checker-webpack-plugin';
import tsLoader                      from 'ts-loader';
import merge                         from 'webpack-merge';
import webpack                       from 'webpack';

export type WebpackPlugin =
  | ((this: webpack.Compiler, compiler: webpack.Compiler) => void)
  | webpack.WebpackPluginInstance;

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

// @ts-ignore: @types/webpack-merge depends on @types/webpack, which isn't compatible with the webpack 5 types
export const makeConfig = (config: webpack.Configuration): webpack.Configuration => merge({
  mode: `none`,
  devtool: false,

  target: `node`,

  node: {
    __dirname: false,
    __filename: false,
  },

  output: {
    libraryTarget: `commonjs2`,
  },

  resolve: {
    extensions: [`.js`, `.ts`, `.tsx`, `.json`],
  },

  module: {
    rules: [{
      test: /\.tsx?$/,
      exclude: /\.d\.ts$/,
      use: [{
        loader: require.resolve(`babel-loader`),
      }, {
        loader: require.resolve(`ts-loader`),
        options: {
          compilerOptions: {
            declaration: false,
            module: `ESNext` as any,
            moduleResolution: `node` as any,
          },
          onlyCompileBundledFiles: true,
          transpileOnly: true,
        } as tsLoader.Options,
      }],
    }],
  },

  externals: {
    // Both of those are native dependencies of text-buffer we can't bundle
    [`fs-admin`]: `{}`,
    [`pathwatcher`]: `{}`,
  },

  plugins: [
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
} as webpack.Configuration, config);
