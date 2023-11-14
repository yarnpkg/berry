// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);
require(`@yarnpkg/monorepo/scripts/setup-local-plugins`);

const fs = require(`fs`);
const path = require(`path`);

const {YarnVersion} = require(`@yarnpkg/core`);

const fastGlob = require(`fast-glob`);
const lightCodeTheme = require(`prism-react-renderer/themes/github`);
const darkCodeTheme = require(`prism-react-renderer/themes/dracula`);

const {miscUtils} = require(`@yarnpkg/core`);

const commandLineHighlight = require(`./src/remark/commandLineHighlight`);
const autoLink = require(`./src/remark/autoLink`);

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
    [
      `docusaurus-plugin-typedoc-api`,
      {
        projectRoot: path.join(__dirname, `../..`),
        packages: miscUtils.mapAndFilter(
          fastGlob.sync([`packages/{yarnpkg,plugin}-*`], {cwd: `../..`, onlyDirectories: true}),
          workspacePath => {
            let category = `Generic Packages`;
            if (workspacePath === `packages/yarnpkg-builder` || workspacePath === `packages/yarnpkg-cli`)
              category = `Yarn Packages`;
            else if (workspacePath.startsWith(`packages/plugin-`))
              category = `Default Plugins`;

            /** @type {Map<string, import('docusaurus-plugin-typedoc-api/lib/types').PackageEntryConfig>} */
            const entries = new Map();
            function resolveEntries(exports) {
              // Only handle export cases found in this monorepo
              for (const [key, value] of Object.entries(exports)) {
                if (typeof value === `object`) {
                  // "exports": { ...: { ... } }
                  resolveEntries(value);
                } else if (!value.endsWith(`.ts`)) {
                  // "exports": { ...: "./path/to.js" }
                  return;
                } else if (key.startsWith(`.`)) {
                  // "exports": { "./path": "./path/to.ts" }
                  const isIndex = key === `.`;
                  entries.set(
                    isIndex ? `index` : key.slice(2),
                    {path: value, label: isIndex ? `Main Entrypoint` : `Entrypoint: ${key.slice(2)}`},
                  );
                } else {
                  // "exports": { "condition": "./path/to.ts" }
                  const isDefault = key === `default`;
                  entries.set(
                    isDefault ? `index` : `[${key}]`,
                    {path: value, label: isDefault ? `Default Entrypoint` : `Condition: ${key}`},
                  );
                }
              }
            }
            const manifest = require(path.join(`../..`, workspacePath, `package.json`));
            if (!manifest.exports)
              return miscUtils.mapAndFilter.skip;
            resolveEntries(manifest.exports);

            return {path: workspacePath, category, entry: Object.fromEntries(entries)};
          },
        ),
        packageCategories: [
          `Generic Packages`,
          `Yarn Packages`,
          `Default Plugins`,
        ],
        readmes: true,
        gitRefName: process.env.COMMIT_REF ?? `master`,
        typedocOptions: {
          plugin: [`./src/typedoc/plugin.ts`],
        },
        remarkPlugins,
      },
    ],
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
          sidebarPath: require.resolve(`./sidebars.js`),
          editUrl: `https://github.com/yarnpkg/berry/edit/master/packages/docusaurus/`,
          remarkPlugins,
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
            to: `blog`,
            label: `Blog`,
            position: `left`,
          },
          {
            to: `api`,
            label: `API`,
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
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
