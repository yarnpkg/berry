/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

const PnpWebpackPlugin = require(`pnp-webpack-plugin`);

module.exports = {
  onCreateWebpackConfig: ({actions}) => {
    actions.setWebpackConfig({
      resolveLoader: {
        plugins: [
          PnpWebpackPlugin.moduleLoader(module),
        ],
      },
      resolve: {
        plugins: [
          PnpWebpackPlugin.bind(`${__dirname}/.cache`, module, `gatsby`),
          PnpWebpackPlugin.bind(`${__dirname}/public`, module, `gatsby`),
          PnpWebpackPlugin,
        ],
      },
    });
  },
};
