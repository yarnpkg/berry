/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

module.exports = {
  onCreateWebpackConfig: ({actions}) => {
    actions.setWebpackConfig({
      resolve: {
        alias: {
          [`@emotion/core`]: require.resolve(`@emotion/core`),
        },
      },
    });
  },
  createPages: async ({actions: {createPage, createRedirect}, graphql}) => {
    const result = await graphql(`{
      allMarkdownRemark {
        edges {
          node {
            frontmatter {
              path
            }
          }
        }
      }
    }`);

    result.data.allMarkdownRemark.edges.forEach(({node}) => {
      createPage({
        path: node.frontmatter.path,
        component: `${__dirname}/src/templates/featureTemplate.js`,
        context: {},
      });
    });

    createRedirect({
      fromPath: `/configuration`,
      toPath: `/configuration/manifest`,
      redirectInBrowser: true,
      isPermanent: true,
    });

    createRedirect({
      fromPath: `/features`,
      toPath: `/features/pnp`,
      redirectInBrowser: true,
      isPermanent: true,
    });
  },
};
