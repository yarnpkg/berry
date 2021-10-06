// @ts-check

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

const path = require(`path`);
const CustomPlugin = require(`./custom`);

/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: `Yarn`,
  tagline: `Dinosaurs are cool`,
  url: `https://yarnpkg.com`,
  baseUrl: `/`,
  onBrokenLinks: `throw`,
  onBrokenMarkdownLinks: `warn`,
  favicon: `img/favicon.ico`,
  organizationName: `yarnpkg`,
  projectName: `berry`,
  plugins: [CustomPlugin],
  themeConfig: {
    navbar: {
      title: `Yarn`,
      logo: {
        alt: `My Site Logo`,
        src: `img/logo.svg`,
      },
      items: [{
        type: `doc`,
        docId: `intro`,
        position: `left`,
        label: `Tutorial`,
      }, {
        to: `/blog`,
        label: `Blog`,
        position: `left`,
      }, {
        href: `https://github.com/facebook/docusaurus`,
        label: `GitHub`,
        position: `right`,
      }],
    },
    footer: {
      style: `dark`,
      copyright: `Copyright © ${new Date().getFullYear()} Yarn Contributors. Built with Docusaurus.`,
      links: [{
        title: `Docs`,
        items: [{
          label: `Tutorial`,
          to: `/docs/intro`,
        }],
      },
      {
        title: `Community`,
        items: [{
          label: `Stack Overflow`,
          href: `https://stackoverflow.com/questions/tagged/docusaurus`,
        }, {
          label: `Discord`,
          href: `https://discordapp.com/invite/docusaurus`,
        }, {
          label: `Twitter`,
          href: `https://twitter.com/docusaurus`,
        }],
      }, {
        title: `More`,
        items: [{
          label: `Blog`,
          to: `/blog`,
        }, {
          label: `GitHub`,
          href: `https://github.com/facebook/docusaurus`,
        }],
      }],
    },
  },
  presets: [
    [`@docusaurus/preset-classic`, {
      docs: {
        sidebarPath: require.resolve(`./sidebars.js`),
        editUrl: `https://github.com/yarnpkg/berry/edit/master/packages/yarnpkg-website/`,
      },
      blog: {
        showReadingTime: true,
        editUrl: `https://github.com/yarnpkg/berry/edit/master/packages/yarnpkg-website/blog/`,
      },
      theme: {
        customCss: require.resolve(`./src/css/custom.css`),
      },
    }],
    [`docusaurus-preset-shiki-twoslash`, {
      themes: [`min-light`, `nord`],
      includeJSDocInHover: true,
      vfsRoot: path.resolve(__dirname, `../..`),
    }],
  ],
};
