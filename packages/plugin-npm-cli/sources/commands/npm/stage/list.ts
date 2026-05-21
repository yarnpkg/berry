import {BaseCommand}                                                                   from '@yarnpkg/cli';
import {Configuration, MessageName, StreamReport, formatUtils, structUtils, treeUtils} from '@yarnpkg/core';
import {npmHttpUtils, npmConfigUtils}                                                  from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                                        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmStageListCommand extends BaseCommand {
  static paths = [
    [`npm`, `stage`, `list`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `list all staged package versions`,
    details: `
      This command will list all staged package versions awaiting approval on the npm registry.

      If a package name is provided, only staged versions of that package will be listed.
    `,
    examples: [[
      `List all staged packages`,
      `yarn npm stage list`,
    ], [
      `List staged versions of a specific package`,
      `yarn npm stage list my-pkg`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  package = Option.String({required: false});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const registry = npmConfigUtils.getDefaultRegistry({configuration, type: npmConfigUtils.RegistryType.PUBLISH_REGISTRY});

    const items = await fetchAllStagedPackages(configuration, registry, this.package ?? undefined);

    await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      json: this.json,
      includeFooter: false,
      includePrefix: false,
    }, async report => {
      if (items.length > 0) {
        report.reportInfo(MessageName.UNNAMED, `The following packages are awaiting approval. Use ${formatUtils.pretty(configuration, `yarn npm stage approve <stageId>`, formatUtils.Type.CODE)} to approve them.`);
        report.reportSeparator();
      } else {
        if (this.package) {
          report.reportInfo(MessageName.UNNAMED, `No staged versions found for package ${this.package}`);
        } else {
          report.reportInfo(MessageName.UNNAMED, `No staged packages found`);
        }
      }
    });

    if (items.length === 0)
      return;

    const tree: treeUtils.TreeNode = {
      children: items.map(item => {
        const ident = structUtils.parseIdent(item.packageName);
        return {
          value: formatUtils.tuple(formatUtils.Type.RESOLUTION, {
            descriptor: structUtils.makeDescriptor(ident, item.tag),
            locator: structUtils.makeLocator(ident, item.version),
          }),
          children: {
            ID: {
              label: `ID`,
              value: formatUtils.tuple(formatUtils.Type.CODE, item.id),
            },
            Staged: {
              label: `Staged on`,
              value: formatUtils.tuple(formatUtils.Type.NO_HINT, item.createdAt),
            },
          },
        };
      }),
    };

    treeUtils.emitTree(tree, {
      configuration,
      json: this.json,
      stdout: this.context.stdout,
      separators: 1,
    });
  }
}

export interface StagedPackage {
  id: string;
  packageName: string;
  version: string;
  tag: string;
  createdAt: string;
  actor: string;
  actorType: string;
  access: string;
  shasum: string;
}

export async function fetchAllStagedPackages(configuration: Configuration, registry: string, packageName?: string): Promise<Array<StagedPackage>> {
  const items: Array<StagedPackage> = [];
  let page = 0;
  const perPage = 100;

  while (true) {
    const query: Record<string, string> = {
      page: String(page),
      perPage: String(perPage),
    };

    if (packageName)
      query.package = packageName;

    const queryString = new URLSearchParams(query).toString();
    const response: any = await npmHttpUtils.get(`/-/stage?${queryString}`, {
      configuration,
      registry,
      jsonResponse: true,
      authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
    });

    items.push(...response.items);

    if (items.length >= response.total || response.items.length < perPage)
      break;

    page++;
  }

  return items;
}
