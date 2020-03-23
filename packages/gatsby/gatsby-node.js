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
  },

  onCreatePage: async ({page, actions: {createPage}}) => {
    if (page.path.match(/^\/package/)) {
      // page.matchPath is a special key that's used for matching pages
      // with corresponding routes only on the client.
      page.matchPath = `/package/*`;
      // Update the page.
      createPage(page);
    }
  },
};
