import type {Options as MDXLoaderOptions, MDXPlugin}          from '@docusaurus/mdx-loader';
import type {LoadContext, Plugin, PluginContentLoadedActions} from '@docusaurus/types';
import {YarnVersion, miscUtils}                               from '@yarnpkg/core';
import type {BaseContext, Definition}                         from 'clipanion';
import {Cli}                                                  from 'clipanion';
import glob                                                   from 'fast-glob';
import jiti                                                   from 'jiti';
import path                                                   from 'path';

const PLUGIN_NAME = `docusaurus-plugin-yarn-cli-docs`;
const ROUTE_PREFIX = `/cli`;
function dedent(value: string) {
  return value.trim().split(`\n`).map(line => line.trimStart()).join(`\n`);
}

const loader = jiti(__filename, {
  cache: true,
  requireCache: false,
});

const binaries: Array<{ name: string, getCli: () => Promise<Cli<BaseContext>>, watch: Array<string> }> = [
  {
    name: `@yarnpkg/cli`,
    getCli: async () => {
      const {getCli} = loader(`@yarnpkg/cli`) as typeof import('@yarnpkg/cli');
      return getCli();
    },
    watch: [`../plugin-*/sources/commands/**/*.{ts,tsx}`],
  },
  {
    name: `@yarnpkg/builder`,
    getCli: async () => {
      const commands = Object.values(loader(`@yarnpkg/builder`) as typeof import('@yarnpkg/builder'));
      return Cli.from(commands, {binaryName: `yarn builder`});
    },
    watch: [`../yarnpkg-builder/sources/commands/**/*.ts`],
  },
  {
    name: `@yarnpkg/pnpify`,
    getCli: async () => {
      const proxyLoader = jiti(require.resolve(`@yarnpkg/pnpify/package.json`), {
        cache: true,
        requireCache: false,
      });
      const commandPaths = await glob([`./sources/commands/**/*.ts`], {cwd: path.dirname(proxyLoader.resolve(`./package.json`))});

      const commands = commandPaths.map(commandPath => proxyLoader(commandPath).default);
      return Cli.from(commands, {binaryName: `yarn pnpify`});
    },
    watch: [`../yarnpkg-pnpify/sources/commands/**/*.ts`],
  },
  {
    name: `@yarnpkg/sdks`,
    getCli: async () => {
      const {SdkCommand} = loader(`@yarnpkg/sdks`) as typeof import('@yarnpkg/sdks');
      return Cli.from(SdkCommand, {binaryName: `yarn sdks`});
    },
    watch: [`../yarnpkg-sdks/sources/commands/**/*.ts`],
  },
];

export type Options = {
  remarkPlugins: Array<MDXPlugin>;
};

const plugin = async function(context: LoadContext, options: Options): Promise<Plugin<Record<string, Array<Definition>>>> {
  async function createBinaryPages(packageName: string, definitions: Array<Definition>, actions: PluginContentLoadedActions) {
    const pages = await Promise.all(
      definitions
        .sort((a, b) => a.path.localeCompare(b.path))
        .map(definition => createCommandPage(packageName, definition, actions)),
    );

    const index = await createBinaryIndexPage(packageName, definitions, actions);

    return {
      sidebarItem: {
        type: `category`,
        label: packageName,
        href: index.route.path,
        collapsible: false,
        collapsed: false,
        items: pages.map(page => page.sidebarItem),
      },
      routes: [
        index.route,
        ...pages.map(page => page.route),
      ],
    };
  }

  async function createBinaryIndexPage(packageName: string, definitions: Array<Definition>, actions: PluginContentLoadedActions) {
    const shortName = packageName.split(`/`).pop();

    const frontMatter = packageName === `@yarnpkg/cli`
      ? {
        slug: ROUTE_PREFIX,
        title: `CLI Reference`,
        description: `List of commands distributed with Yarn`,
      }
      : {
        slug: `${ROUTE_PREFIX}/${shortName}`,
        title: `${packageName} CLI Reference`,
        description: `List of commands distributed with ${packageName}`,
      };

    const categories = new Map<string, Array<Definition>>();
    for (const definition of definitions)
      miscUtils.getArrayWithDefault(categories, definition.category ?? `General commands`).push(definition);

    const sections = [
      dedent(`
        ---
        ${Object.entries(frontMatter).map(([key, value]) => `${key}: "${value}"`).join(`\n`)}
        ---

        import Link from '@docusaurus/Link';
      `),

      ...Array.from(categories, ([category, definitions]) => dedent(`
        ${categories.size > 1 ? `## ${category}` : ``}

        <table>
          <tbody>
            ${definitions.map(definition => dedent(`
              <tr>
                <td><Link href="${commandSlug(packageName, definition)}">${definition.path}</Link></td>
                <td>${definition.description ? `${definition.description[0].toUpperCase()}${definition.description.slice(1, -1)}.` : ``}</td>
              </tr>
            `)).join(`\n`)}
          </tbody>
        </table>
      `)),
    ];

    const file = await actions.createData(`${frontMatter.slug.slice(1)}.mdx`, sections.filter(section => section !== null).join(`\n\n`));
    await actions.createData(`${frontMatter.slug.slice(1)}.json`, JSON.stringify({
      id: frontMatter.slug.slice(1),
      title: frontMatter.title,
      description: frontMatter.description,
      slug: frontMatter.slug,
      permalink: frontMatter.slug,
      sidebar: `cli`,

      source: file,
      sourceDirName: path.dirname(file),

      draft: false,
      unlisted: false,
      tags: [],
      version: `current`,

      frontMatter,
    }));

    return {
      route: {
        path: frontMatter.slug,
        exact: true,
        component: `@theme/DocItem`,
        modules: {content: file},
        sidebar: `cli`,
      },
    };
  }

  async function createCommandPage(packageName: string, definition: Definition,  actions: PluginContentLoadedActions) {
    const shortName = packageName.split(`/`).pop();
    const slug = commandSlug(packageName, definition);

    const frontMatter = {
      id: slug.slice(1),
      slug,
      title: definition.path,
      description: definition.description ? `${definition.description[0].toUpperCase()}${definition.description.slice(1, -1)}.` : ``,
    };

    const sections = [
      // Frontmatter
      dedent(`
        ---
        ${Object.entries(frontMatter).map(([key, value]) => `${key}: "${value}"`).join(`\n`)}
        ---
      `),

      // Import
      dedent(`
        import {TerminalCode} from '@site/src/components/TerminalCode'
      `),

      // Package Note
      packageName !== `@yarnpkg/cli`
        ? dedent(`
          :::note
          To use this command, you need to use the [\`${packageName}\`](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-${shortName}/README.md) package either:
          - By installing it locally using [\`yarn add\`](/cli/add) and running it using [\`yarn run\`](/cli/run)
          - By downloading and running it in a temporary environment using [\`yarn dlx\`](/cli/dlx)
          :::
        `)
        : null,

      // Description
      frontMatter.description
        ? dedent(`
            <div className="subtitle">
            ${frontMatter.description}
            </div>
          `)
        : null,

      // Usage
      dedent(`
        ## Usage

        <TerminalCode command="${definition.usage}" />
      `),

      // Examples
      definition.examples
        ? dedent(`
            ## Examples

            ${definition.examples.map(([description, example]) => dedent(`
              <p>${description}:</p>

              \`\`\`
              ${example}
              \`\`\`
            `)).join(`\n\n`)}
          `)
        : null,

      // Details
      definition.details
        ? dedent(`
            ## Details

            ${definition.details}
          `)
        : null,

      // Options
      definition.options.length > 0
        ? dedent(`
            ## Options

            | Definition | Description |
            | ---------- | ----------- |
            ${definition.options.map(({definition, description}) => dedent(`
              | <h4 id="${encodeURIComponent((`options-${definition}`).replace(/-+/g, `-`))}" className="header-code"><code className="language-text">${definition}</code></h4> | ${description} |
            `)).join(`\n`)}
          `)
        : null,
    ];

    const file = await actions.createData(`${frontMatter.id}.mdx`, sections.filter(section => section !== null).join(`\n\n`));
    await actions.createData(`${frontMatter.id}.json`, JSON.stringify({
      id: frontMatter.id,
      title: frontMatter.title,
      description: frontMatter.description,
      slug: frontMatter.slug,
      permalink: frontMatter.slug,
      sidebar: `cli`,

      source: file,
      sourceDirName: path.dirname(file),

      draft: false,
      unlisted: false,
      tags: [],
      version: `current`,

      frontMatter,
    }));

    return {
      sidebarItem: {
        type: `link`,
        label: frontMatter.title,
        href: frontMatter.slug,
        docId: frontMatter.id,
        unlisted: false,
      },
      route: {
        path: frontMatter.slug,
        exact: true,
        component: `@theme/DocItem`,
        modules: {content: file},
        sidebar: `cli`,
      },
    };
  }

  function commandSlug(packageName: string, definition: Definition) {
    const route = definition.path.split(` `).slice(1).join(`/`);
    return `${ROUTE_PREFIX}/${route}${packageName === `@yarnpkg/${route}` ? `/default` : ``}`;
  }

  return {
    name: PLUGIN_NAME,
    async loadContent() {
      return Object.fromEntries(
        await Promise.all(binaries.map(async ({name, getCli}) => {
          const cli = await getCli();
          return [name, cli.definitions()] as const;
        })),
      );
    },
    async contentLoaded({content, actions}) {
      const pages = await Promise.all(
        Object.entries(content).map(([packageName, definitions]) => createBinaryPages(packageName, definitions, actions)),
      );

      const version = await actions.createData(`version-metadata.json`, JSON.stringify({
        pluginId: `default`,
        version: `current`,
        label: `master (${YarnVersion})`,
        banner: null,
        badge: false,
        noIndex: false,
        className: `docs-version-current`,
        isLast: true,
        docsSidebars: {
          cli: pages.map(page => page.sidebarItem),
        },
        docs: {},
      }));

      actions.addRoute({
        path: ROUTE_PREFIX,
        exact: false,
        component: `@theme/DocsRoot`,
        routes: [
          {
            path: ROUTE_PREFIX,
            exact: false,
            component: `@theme/DocVersionRoot`,
            modules: {version},
            routes: [
              {
                path: ROUTE_PREFIX,
                exact: false,
                component: `@theme/DocRoot`,
                routes: pages.flatMap(page => page.routes),
              },
            ],
          },
        ],
      });
    },
    configureWebpack(config, isServer, utils) {
      return {
        module: {
          rules: [
            {
              test: /\.mdx$/,
              include: path.join(context.generatedFilesDir, PLUGIN_NAME, `default`),
              use: [
                utils.getJSLoader({isServer}),
                {
                  loader: require.resolve(`@docusaurus/mdx-loader`),
                  options: {
                    admonitions: true,
                    siteDir: context.siteDir,
                    staticDirs: [...context.siteConfig.staticDirectories, path.join(context.siteDir, `static`)],
                    isMDXPartial: () => false,
                    createAssets: () => ({image: undefined}),
                    metadataPath: mdxPath => mdxPath.replace(/.mdx$/, `.json`),
                    remarkPlugins: options.remarkPlugins,
                    markdownConfig: context.siteConfig.markdown,
                  } satisfies MDXLoaderOptions,
                },
              ],
            },
          ],
        },
      };
    },

    getPathsToWatch() {
      return binaries.flatMap(({watch}) => watch);
    },
  };
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
