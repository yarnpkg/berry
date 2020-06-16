/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

const MonacoWebpackPlugin = require(`monaco-editor-webpack-plugin`);
const fs = require(`fs`);
const path = require(`path`);

const regexExternalLink = /^(?:https?:)?\/\//;

const staticRedirectsPath = path.join(__dirname, './static/_redirects');
const staticRedirects = fs.readFileSync(staticRedirectsPath).toString();
const redirectLines = staticRedirects.replace(/\n+/g,'\n').split('\n');

const redirects = [];


for (const redirectLine of redirectLines) {
  const chunks = redirectLine.split(/\s/);
  if (chunks.length !== 3)
    continue;
  const [fromPath, toPath, codeStr] = chunks;
  const statusCode = parseInt(codeStr);
  if (toPath.match(regexExternalLink))
    continue;

  redirects.push({
    fromPath,
    toPath,
    isPermanent: statusCode === 301,
    redirectInBrowser: true,
  });
}

module.exports = {
  onCreateWebpackConfig: ({actions}) => {
    actions.setWebpackConfig({
      resolve: {
        alias: {
          [`@emotion/core`]: require.resolve(`@emotion/core`),
        },
      },
      plugins: [
        new MonacoWebpackPlugin({
          languages: [`javascript`, `typescript`],
        }),
      ],
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

    for (const redirect of redirects) {
      createRedirect(redirect);
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
