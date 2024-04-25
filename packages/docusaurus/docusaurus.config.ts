import '@yarnpkg/monorepo/scripts/setup-local-plugins';
import type {Options}                                               from '@docusaurus/preset-classic';
import type {Config}                                                from '@docusaurus/types';
import {YarnVersion}                                                from '@yarnpkg/core';
import type {DocusaurusPluginTypeDocApiOptions, PackageEntryConfig} from 'docusaurus-plugin-typedoc-api/src/types';
import glob                                                         from 'fast-glob';
import * as fs                                                      from 'node:fs/promises';
import * as path                                                    from 'node:path';
import {themes}                                                     from 'prism-react-renderer';
import {satisfies}                                                  from 'semver';

import * as autoLink                                                from './src/remark/autoLink';
import * as commandLineHighlight                                    from './src/remark/commandLineHighlight';

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

function typedocPackageCategory(path: string) {
  if (path === `packages/yarnpkg-builder` || path === `packages/yarnpkg-cli`) {
    return `Yarn Packages`;
  } else if (path.startsWith(`packages/plugin-`)) {
    return `Default Plugins`;
  } else {
    return `Generic Packages`;
  }
}
async function typedocPluginConfig(): Promise<Partial<DocusaurusPluginTypeDocApiOptions>> {
  // Only handle export cases found in this monorepo
  type PackageExports = {[key: string]: PackageExports} | string;

  function resolveEntries(exports: PackageExports): Array<[string, PackageEntryConfig]> {
    return Object.entries(exports).flatMap(([key, value]) => {
      if (typeof value === `object`) {
        // "exports": { ...: { ... } }
        return resolveEntries(value);
      } else if (!value.endsWith(`.ts`)) {
        // "exports": { ...: "./path/to.js" }
        return [];
      } else if (key.startsWith(`.`)) {
        // "exports": { "./path": "./path/to.ts" }
        const isIndex = key === `.`;
        return [[
          isIndex ? `index` : key.slice(2),
          {path: value, label: isIndex ? `Main Entrypoint` : `Entrypoint: ${key.slice(2)}`},
        ]];
      } else {
        // "exports": { "condition": "./path/to.ts" }
        const isDefault = key === `default`;
        return [[
          isDefault ? `index` : `[${key}]`,
          {path: value, label: isDefault ? `Default Entrypoint` : `Condition: ${key}`},
        ]];
      }
    });
  }

  const workspacePath = await glob([`packages/{yarnpkg,plugin}-*`], {cwd: `../..`, onlyDirectories: true});
  const packages = await Promise.all(
    workspacePath.map(async workspacePath => {
      const manifest = JSON.parse(
        await fs.readFile(path.join(__dirname, `../..`, workspacePath, `package.json`), `utf-8`),
      );
      return {
        path: workspacePath,
        category: typedocPackageCategory(workspacePath),
        entry: Object.fromEntries(resolveEntries(manifest.exports ?? {})),
      };
    }),
  );

  return {
    projectRoot: path.join(__dirname, `../..`),
    packages,
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
  };
}

async function getPreviousVersions(): Promise<Array<{ label: string, href: string }>> {
  const [npmResponse, repoResponse] = await Promise.all([
    // eslint-disable-next-line no-restricted-globals
    fetch(`https://registry.npmjs.org/yarn`, {headers: {accept: `application/vnd.npm.install-v1+json`}})
      .then(response => response.json()),
    // eslint-disable-next-line no-restricted-globals
    fetch(`https://repo.yarnpkg.com/tags`)
      .then(response => response.json()),
  ]);

  return [
    {
      label: repoResponse.tags.find((version: string) => satisfies(version, `^3`)),
      href: `https://v3.yarnpkg.com`,
    },
    {
      label: npmResponse[`dist-tags`].latest,
      href: `https://classic.yarnpkg.com/en/docs`,
    },
  ];
}

// eslint-disable-next-line arca/no-default-export
export default async function (): Promise<Config> {
  return {
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
        await typedocPluginConfig(),
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
          src: `data:image/svg+xml;base64,${await fs.readFile(`${__dirname}/static/img/yarn-white.svg`, `base64`)}`,
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
            dropdownItemsAfter: await getPreviousVersions(),
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
}
