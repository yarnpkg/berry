import '@yarnpkg/monorepo/scripts/setup-local-plugins';
import type {Options}            from '@docusaurus/preset-classic';
import type {Config}             from '@docusaurus/types';
import {YarnVersion}             from '@yarnpkg/core';
import * as fs                   from 'node:fs';
import {themes}                  from 'prism-react-renderer';

import * as autoLink             from './src/remark/autoLink';
import * as commandLineHighlight from './src/remark/commandLineHighlight';

const remarkPlugins = [
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
];

const config: Config = {
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
      {
        blog: {
          routeBasePath: `blog`,
          remarkPlugins,
        },
        docs: {
          routeBasePath: `/`,
          versions: {
            current: {
              label: `master (${YarnVersion})`,
            },
          },
          sidebarPath: require.resolve(`./sidebars.ts`),
          editUrl: `https://github.com/yarnpkg/berry/edit/master/packages/docusaurus/`,
          remarkPlugins,
        },
        theme: {
          customCss: require.resolve(`./src/css/custom.css`),
        },
      } satisfies Options,
    ],
  ],

  scripts: [
    `/js/custom.js`,
  ],

  themeConfig: {
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
          to: `blog`,
          label: `Blog`,
          position: `left`,
        },
        {
          type: `docsVersionDropdown`,
          position: `right`,
          dropdownActiveClassDisabled: true,
          dropdownItemsAfter: [
            {
              label: `3.6.4`,
              href: `https://v3.yarnpkg.com`,
            },
            {
              label: `1.22.19`,
              href: `https://classic.yarnpkg.com/en/docs`,
            },
          ],
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
      theme: themes.github,
      darkTheme: themes.dracula,
      additionalLanguages: [`bash`, `json`],
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default config;
