module.exports = {
  pathPrefix: process.env.NETLIFY ? `/` : `/berry`,
  siteMetadata: {
    title: `Yarn - Package Manager`,
    description: `Fast, reliable, and secure dependency management.`,
    author: `yarnpkg`,
    menuLinks: [{
      name: `Home`,
      link: `/`,
    }, {
      name: `Getting started`,
      link: `/getting-started`,
    }, {
      name: `Configuration`,
      link: `/configuration`,
    }, {
      name: `Features`,
      link: `/features`,
    }, {
      name: `CLI`,
      link: `/cli`,
    }, {
      name: `Advanced`,
      link: `/advanced`,
    }, {
      name: `API`,
      link: `/api`,
      external: true,
    }],
    algolia: {
      // Note that the appId and appKey are specific to Yarn's website - please
      // don't use them anywhere else without asking Algolia's permission
      appId: `OFCNCOG2CU`,
      apiKey: `f54e21fa3a2a0160595bb058179bfb1e`,
      indexName: `npm-search`,
    },
  },
  plugins: [
    `gatsby-plugin-emotion`,
    `gatsby-plugin-react-helmet`,
    {
      resolve: `gatsby-plugin-algolia-docsearch`,
      options: {
        specs: [{
          apiKey: `029f65f2c00301615fd14958b67d6730`,
          indexName: `yarnpkg_next`,
          inputSelector: `.docsearch-mobile`,
        }, {
          apiKey: `029f65f2c00301615fd14958b67d6730`,
          indexName: `yarnpkg_next`,
          inputSelector: `.docsearch-desktop`,
        }],
      },
    },
    {
      resolve: `gatsby-plugin-prefetch-google-fonts`,
      options: {
        fonts: [{
          family: `Open Sans`,
          variants: [`300`, `400`, `700`],
        }, {
          family: `PT Mono`,
        }],
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/images`,
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `Yarn`,
        /* eslint-disable @typescript-eslint/camelcase */
        short_name: `yarn`,
        start_url: `/`,
        background_color: `#2188b6`,
        theme_color: `#2188b6`,
        /* eslint-enable @typescript-eslint/camelcase */
        display: `minimal-ui`,
        icon: `src/images/yarn-kitten.svg`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/content`,
        name: `markdown-pages`,
      },
    },
    {
      resolve: `gatsby-plugin-clipanion-cli`,
      options: {
        binaries: [
          {
            namespace: null,
            argv0: `yarn`,
            binary: `${__dirname}/../../scripts/run-yarn.js`,
          },
          {
            namespace: `pnpify`,
            argv0: `pnpify`,
            binary: `${__dirname}/../../scripts/run-pnpify.js`,
          },
          {
            namespace: `builder`,
            argv0: `builder`,
            binary: `${__dirname}/../../scripts/run-builder.js`,
          },
        ],
      },
    },
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          {
            resolve: `gatsby-remark-table-of-contents`,
          },
          `gatsby-remark-autolink-headers`,
          `gatsby-remark-prismjs`,
        ],
      },
    },
    {
      resolve: `gatsby-plugin-catch-links`,
      options: {
        excludePattern: /^\/api$/,
      },
    },
    {
      resolve: `gatsby-plugin-remove-trailing-slashes`,
    },
    // this (optional) plugin enables Progressive Web App + Offline functionality
    // To learn more, visit: https://gatsby.dev/offline
    // 'gatsby-plugin-offline',
  ],
};
