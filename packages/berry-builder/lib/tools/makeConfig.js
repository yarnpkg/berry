"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_1 = __importDefault(require("webpack"));
const webpack_merge_1 = __importDefault(require("webpack-merge"));
// @ts-ignore
const pnp_webpack_plugin_1 = __importDefault(require("pnp-webpack-plugin"));
// TypeScript (ts-loader) isn't able to find out the typeRoots when using zip
// loading (because they're stored within the zip files). So we need to use
// PnPify to help them find them.
//
// We don't need to do this for PnPify itself (hence the check) because we
// explicitly list all the typeRoots within its tsconfig (otherwise it would
// need to use itself to build itself 🤡).
if (!module.parent.filename.includes(`berry-pnpify`))
    require(`@berry/pnpify/lib`).patchFs();
exports.makeConfig = (config) => webpack_merge_1.default({
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
        alias: {
            [`supports-color`]: `supports-color/index`,
            [`agentkeepalive`]: `agentkeepalive/index`,
        },
        extensions: [`.js`, `.ts`, `.tsx`, `.json`],
        mainFields: [`browser`, `module`, `main`],
        plugins: [pnp_webpack_plugin_1.default],
    },
    module: {
        rules: [{
                test: /\.tsx?$/,
                exclude: /\.d\.ts$/,
                loader: require.resolve(`ts-loader`),
                options: pnp_webpack_plugin_1.default.tsLoaderOptions({
                    compilerOptions: {
                        declaration: false,
                    },
                }),
            }],
    },
    externals: {
        // Both of those are native dependencies of text-buffer we can't bundle
        [`fs-admin`]: `{}`,
        [`pathwatcher`]: `{}`,
    },
    plugins: [
        new webpack_1.default.IgnorePlugin(/^encoding$/, /node-fetch/),
        new webpack_1.default.DefinePlugin({ [`IS_WEBPACK`]: `true` }),
    ],
}, config);
