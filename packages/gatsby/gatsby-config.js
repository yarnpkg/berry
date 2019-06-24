module.exports = {
  pathPrefix: process.env.NETLIFY ? `/` : `/berry`,
  siteMetadata: {
    title: `Yarn - Package Manager`,
    description: `Foo`,
    author: ``,
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
      resolve: `gatsby-plugin-prefetch-google-fonts`,
      options: {
        fonts: [{
          family: `Open Sans`,
          variants: [`300`, `400`, `700`],
        }, {
          family: `Abel`,
          variants: [`300`, `400`],
        }, {
          family: `Baumans`,
          variants: [`400`],
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
        short_name: `yarn`,
        start_url: `/`,
        background_color: `#2188b6`,
        theme_color: `#2188b6`,
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
        argv0: `yarn`,
        binary: `${__dirname}/../../scripts/run-yarn.js`,
      },
    },
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          `gatsby-remark-autolink-headers`,
          `gatsby-remark-prismjs`,
        ],
      },
    },
    {
      resolve: `gatsby-plugin-catch-links`,
    },
    {
      resolve: `gatsby-plugin-remove-trailing-slashes`,
    },
    // this (optional) plugin enables Progressive Web App + Offline functionality
    // To learn more, visit: https://gatsby.dev/offline
    // 'gatsby-plugin-offline',
  ],
}
