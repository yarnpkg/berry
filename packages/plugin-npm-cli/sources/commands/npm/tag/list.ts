import {BaseCommand, WorkspaceRequiredError}                                                                     from '@yarnpkg/cli';
import {Configuration, Project, Ident, structUtils, ReportError, MessageName, formatUtils, treeUtils, miscUtils} from '@yarnpkg/core';
import {ppath, Filename}                                                                                         from '@yarnpkg/fslib';
import {npmHttpUtils}                                                                                            from '@yarnpkg/plugin-npm';
import {Command, UsageError, Usage}                                                                              from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmTagListCommand extends BaseCommand {
  @Command.String({required: false})
  package?: string;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `list all dist-tags of a package`,
    details: `
      This command will list all tags of a package from the npm registry.

      If the package is not specified, Yarn will default to the current workspace.

      If the \`--json\` flag is set, the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
    examples: [[
      `List all tags of package \`my-pkg\``,
      `yarn npm tag list my-pkg`,
    ]],
  });

  @Command.Path(`npm`, `tag`, `list`)
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
        throw new UsageError(`Missing 'name' field in ${ppath.join(workspace.cwd, Filename.manifest)}`);

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
  }).catch(err => {
    if (err.name !== `HTTPError`) {
      throw err;
    } else if (err.response.statusCode === 404) {
      throw new ReportError(MessageName.EXCEPTION, `Package not found`);
    } else {
      throw new ReportError(MessageName.EXCEPTION, err.toString());
    }
  });
}
