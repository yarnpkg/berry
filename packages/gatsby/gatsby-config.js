module.exports = {
  pathPrefix: `/berry`,
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
    }]
  },
  plugins: [
    `gatsby-plugin-emotion`,
    `gatsby-plugin-react-helmet`,
    {
      resolve: `gatsby-plugin-prefetch-google-fonts`,
      options: {
        fonts: [{
          family: `Open Sans`,
          variants: [`300`, `400`],
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
        name: `gatsby-starter-default`,
        short_name: `starter`,
        start_url: `/`,
        background_color: `#663399`,
        theme_color: `#663399`,
        display: `minimal-ui`,
        icon: `src/images/gatsby-icon.png`, // This path is relative to the root of the site.
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/content`,
        name: `markdown-pages`,
      },
    },
    `gatsby-transformer-remark`,
    `gatsby-plugin-remove-trailing-slashes`,
    // this (optional) plugin enables Progressive Web App + Offline functionality
    // To learn more, visit: https://gatsby.dev/offline
    // 'gatsby-plugin-offline',
  ],
}
