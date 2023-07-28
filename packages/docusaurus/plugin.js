const {createRequire} = require(`module`);
const webpack = createRequire(require.resolve(`@docusaurus/core/package.json`))(`webpack`);

// docusaurus-plugin/src/index.js
module.exports = function(context, options) {
  return {
    name: `docusaurus-plugin`,
    configureWebpack(config, isServer, utils) {
      return {
        resolve: {
          fallback: {
            fs: false,
            module: false,
            os: require.resolve(`os-browserify`),
            path: require.resolve(`path-browserify`),
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
