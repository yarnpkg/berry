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
    const everything = await graphql(`{
      allMarkdownRemark {
        edges {
          node {
            frontmatter {
              category
              path
            }
          }
        }
      }
    }`);

    for (const {node} of everything.data.allMarkdownRemark.edges) {
      createPage({
        path: node.frontmatter.path,
        component: `${__dirname}/src/templates/article.js`,
        context: {category: node.frontmatter.category},
      });
    }

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

    createRedirect({
      fromPath: `/cli`,
      toPath: `/cli/install`,
      redirectInBrowser: true,
      isPermanent: true,
    });

    createRedirect({
      fromPath: `/advanced`,
      toPath: `/advanced/architecture`,
      redirectInBrowser: true,
      isPermanent: true,
    });
  },
};
