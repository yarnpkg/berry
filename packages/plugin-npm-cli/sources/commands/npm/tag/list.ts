import {BaseCommand, WorkspaceRequiredError}                                           from '@yarnpkg/cli';
import {Configuration, Project, Ident, structUtils, formatUtils, treeUtils, miscUtils} from '@yarnpkg/core';
import {ppath, Filename, npath}                                                        from '@yarnpkg/fslib';
import {npmHttpUtils}                                                                  from '@yarnpkg/plugin-npm';
import {Command, UsageError, Usage, Option}                                            from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmTagListCommand extends BaseCommand {
  static paths = [
    [`npm`, `tag`, `list`],
  ];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `list all dist-tags of a package`,
    details: `
      This command will list all tags of a package from the npm registry.

      If the package is not specified, Yarn will default to the current workspace.
    `,
    examples: [[
      `List all tags of package \`my-pkg\``,
      `yarn npm tag list my-pkg`,
    ]],
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  package = Option.String({required: false});

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);

    let ident: Ident;
    if (typeof this.package !== `undefined`) {
      ident = structUtils.parseIdent(this.package);
    } else {
      if (!workspace)
        throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

      if (!workspace.manifest.name)
        throw new UsageError(`Missing 'name' field in ${npath.fromPortablePath(ppath.join(workspace.cwd, Filename.manifest))}`);

      ident = workspace.manifest.name;
    }

    const distTags = await getDistTags(ident, configuration);
    const distTagEntries = miscUtils.sortMap(Object.entries(distTags), ([tag]) => tag);

    const tree: treeUtils.TreeNode = {
      children: distTagEntries.map(([tag, version]) => ({
        value: formatUtils.tuple(formatUtils.Type.RESOLUTION, {
          descriptor: structUtils.makeDescriptor(ident, tag),
          locator: structUtils.makeLocator(ident, version),
        }),
      })),
    };

    return treeUtils.emitTree(tree, {
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    });
  }
}

export async function getDistTags(ident: Ident, configuration: Configuration): Promise<Record<string, string>> {
  const url = `/-/package${npmHttpUtils.getIdentUrl(ident)}/dist-tags`;

  return npmHttpUtils.get(url, {
    configuration,
    ident,
    jsonResponse: true,
    customErrorMessage: npmHttpUtils.customPackageError,
  });
}
