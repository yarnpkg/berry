// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require(`prism-react-renderer/themes/github`);
const darkCodeTheme = require(`prism-react-renderer/themes/dracula`);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: `Yarn`,
  tagline: `Dinosaurs are cool`,
  url: `https://your-docusaurus-test-site.com`,
  baseUrl: `/`,
  onBrokenLinks: `throw`,
  onBrokenMarkdownLinks: `warn`,
  favicon: `img/favicon.ico`,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: `facebook`, // Usually your GitHub org/user name.
  projectName: `docusaurus`, // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: `en`,
    locales: [`en`],
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
            `https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/`,
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
            label: `Getting Started`,
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
        links: [
          {
            title: `Docs`,
            items: [
              {
                label: `Tutorial`,
                to: `/docs/intro`,
              },
            ],
          },
          {
            title: `Community`,
            items: [
              {
                label: `Stack Overflow`,
                href: `https://stackoverflow.com/questions/tagged/yarnpkg`,
              },
              {
                label: `Discord`,
                href: `https://discordapp.com/invite/yarnpkg`,
              },
              {
                label: `Twitter`,
                href: `https://twitter.com/yarnpkg`,
              },
            ],
          },
          {
            title: `More`,
            items: [
              {
                label: `Discord`,
                href: `https://discord.gg/yarnpkg`,
              },
              {
                label: `GitHub`,
                href: `https://github.com/yarnpkg/berry`,
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Yarn Contributors, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
