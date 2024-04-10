import type {Options as MDXLoaderOptions, MDXPlugin}          from '@docusaurus/mdx-loader';
import type {LoadContext, Plugin, PluginContentLoadedActions} from '@docusaurus/types';
import {getCli}                                               from '@yarnpkg/cli';
import {YarnVersion}                                          from '@yarnpkg/core';
import type {BaseContext, Definition}                         from 'clipanion';
import {Cli}                                                  from 'clipanion';
import glob                                                   from 'fast-glob';
import {createRequire}                                        from 'node:module';
import path                                                   from 'path';

const PLUGIN_NAME = `docusaurus-plugin-yarn-cli-docs`;
const ROUTE_PREFIX = `/cli`;

function dedent(value: string) {
  return value.trim().split(`\n`).map(line => line.trimStart()).join(`\n`);
}

const binaries = [
  {
    name: `@yarnpkg/cli`,
    getCli,
  },
  {
    name: `@yarnpkg/builder`,
    getCli: async () => {
      const commands = Object.values(await import(`@yarnpkg/builder`));
      return Cli.from(commands, {binaryName: `yarn builder`});
    },
  },
  {
    name: `@yarnpkg/pnpify`,
    getCli: async () => {
      const proxyRequire = createRequire(require.resolve(`@yarnpkg/pnpify/package.json`));
      const commandPaths = await glob([`./sources/commands/**/*.ts`], {cwd: path.dirname(proxyRequire.resolve(`./package.json`))});

      const commands = commandPaths.map(commandPath => proxyRequire(commandPath).default);
      return Cli.from(commands, {binaryName: `yarn pnpify`});
    },
  },
  {
    name: `@yarnpkg/sdks`,
    getCli: async () => {
      const {SdkCommand} = await import(`@yarnpkg/sdks`);
      return Cli.from(SdkCommand, {binaryName: `yarn sdks`});
    },
  },
] satisfies Array<{ name: string, getCli: () => Promise<Cli<BaseContext>> }>;

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

    return {
      sidebarItem: {
        type: `category`,
        label: packageName,
        collapsible: false,
        collapsed: false,
        items: pages.map(page => page.sidebarItem),
      },
      routes: pages.map(page => page.route),
    };
  }

  async function createCommandPage(packageName: string, definition: Definition,  actions: PluginContentLoadedActions) {
    const shortName = packageName.split(`/`).pop();
    const route = definition.path.split(` `).slice(1).join(`/`);
    const slug = `${ROUTE_PREFIX}/${route}${route === shortName ? `/default` : ``}`;

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
            `)).join(``)}
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
    async contentLoaded({content: binaries, actions}) {
      const pages = await Promise.all(
        Object.entries(binaries).map(([packageName, definitions]) => createBinaryPages(packageName, definitions, actions)),
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
              include: path.join(context.generatedFilesDir, PLUGIN_NAME),
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
  };
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
