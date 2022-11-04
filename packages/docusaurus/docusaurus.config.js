// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require(`prism-react-renderer/themes/github`);
const darkCodeTheme = require(`prism-react-renderer/themes/dracula`);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: `Yarn`,
  tagline: `Yarn, the modern JavaScript package manager`,
  url: `https://yarnpkg.com`,
  baseUrl: `/`,
  onBrokenLinks: `throw`,
  onBrokenMarkdownLinks: `warn`,
  favicon: `img/favicon.ico`,

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: `en`,
    locales: [`en`],
  },

  webpack: {
    jsLoader: isServer => ({
      loader: require.resolve(`esbuild-loader`),
      options: {
        loader: `tsx`,
        format: isServer ? `cjs` : undefined,
        target: isServer ? `node12` : `es2017`,
      },
    }),
  },

  presets: [
    [
      `classic`,
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        blog: false,
        docs: {
          routeBasePath: `/`,
          sidebarPath: require.resolve(`./sidebars.js`),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            `https://github.com/yarnpkg/berry/tree/master/packages/docusaurus/`,
        },
        theme: {
          customCss: require.resolve(`./src/css/custom.css`),
        },
      }),
    ],
  ],

  scripts: [
    `/js/custom.js`,
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: `light`,
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      algolia: {
        appId: `BH4D9OD16A`,
        apiKey: `029f65f2c00301615fd14958b67d6730`,
        indexName: `yarnpkg_next`,
      },
      navbar: {
        title: `Yarn`,
        logo: {
          alt: `Yarn Logo`,
          src: `img/yarn-white.svg`,
        },
        items: [
          {
            type: `docSidebar`,
            sidebarId: `gettingStarted`,
            position: `left`,
            label: `Get Started`,
          },
          {
            type: `docSidebar`,
            sidebarId: `features`,
            position: `left`,
            label: `Features`,
          },
          {
            type: `docSidebar`,
            sidebarId: `cli`,
            label: `CLI`,
            position: `left`,
          },
          {
            type: `docSidebar`,
            sidebarId: `configuration`,
            label: `Configuration`,
            position: `left`,
          },
          {
            type: `doc`,
            docId: `advanced/architecture`,
            position: `left`,
            label: `Advanced`,
          },
          {
            href: `https://discord.gg/yarnpkg`,
            label: `Discord`,
            position: `right`,
          },
          {
            href: `https://github.com/yarnpkg/berry`,
            label: `GitHub`,
            position: `right`,
          },
        ],
      },
      footer: {
        style: `dark`,
        links: [],
        copyright: `Copyright © ${new Date().getFullYear()} Yarn Contributors, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
