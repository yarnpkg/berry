// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);
require(`@yarnpkg/monorepo/scripts/setup-local-plugins`);

const fs = require(`fs`);

const lightCodeTheme = require(`prism-react-renderer/themes/github`);
const darkCodeTheme = require(`prism-react-renderer/themes/dracula`);

const commandLineHighlight = require(`./src/remark/commandLineHighlight`);
const autoLink = require(`./src/remark/autoLink`);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: `Yarn`,
  tagline: `Yarn, the modern JavaScript package manager`,
  url: process.env.DEPLOY_PRIME_URL !== `https://master--yarn4.netlify.app`
    ? process.env.DEPLOY_PRIME_URL ?? `https://yarnpkg.com`
    : `https://yarnpkg.com`,
  baseUrl: `/`,
  // TODO: Switch back to `throw`
  onBrokenLinks: `warn`,
  onBrokenMarkdownLinks: `warn`,
  favicon: `img/yarn-favicon.svg`,
  trailingSlash: false,

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: `en`,
    locales: [`en`],
  },

  plugins: [
    require.resolve(`./plugin`),
  ],

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
          editUrl: `https://github.com/yarnpkg/berry/edit/master/packages/docusaurus/`,
          remarkPlugins: [
            commandLineHighlight.plugin(),
            autoLink.plugin([{
              sourceType: `json-schema`,
              path: require.resolve(`./static/configuration/manifest.json`),
              urlGenerator: name => `/configuration/manifest#${name}`,
            }, {
              sourceType: `json-schema`,
              path: require.resolve(`./static/configuration/yarnrc.json`),
              urlGenerator: name => `/configuration/yarnrc#${name}`,
            }]),
          ],
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
      image: `img/social-preview.png`,
      colorMode: {
        defaultMode: `light`,
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
      algolia: {
        appId: `STXW7VT1S5`,
        apiKey: `ecdfaea128fd901572b14543a2116eee`,
        indexName: `yarnpkg_next`,
        searchPagePath: `docs/search`,
      },
      navbar: {
        title: `Yarn`,
        logo: {
          alt: `Yarn Logo`,
          src: `data:image/svg+xml;base64,${fs.readFileSync(`${__dirname}/static/img/yarn-white.svg`, `base64`)}`,
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
            type: `docSidebar`,
            sidebarId: `advanced`,
            label: `Advanced`,
            position: `left`,
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
