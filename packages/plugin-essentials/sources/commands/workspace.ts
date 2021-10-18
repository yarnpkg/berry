import {WorkspaceRequiredError, BaseCommand} from '@yarnpkg/cli';
import {Configuration, Project, Workspace}   from '@yarnpkg/core';
import {structUtils}                         from '@yarnpkg/core';
import {Command, Option, Usage, UsageError}  from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class WorkspaceCommand extends BaseCommand {
  static paths = [
    [`workspace`],
  ];

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `run a command within the specified workspace`,
    details: `
      This command will run a given sub-command on a single workspace.
    `,
    examples: [[
      `Add a package to a single workspace`,
      `yarn workspace components add -D react`,
    ], [
      `Run build script on a single workspace`,
      `yarn workspace components run build`,
    ]],
  });

  workspaceName = Option.String();
  commandName = Option.String();

  args = Option.Proxy();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: cwdWorkspace} = await Project.find(configuration, this.context.cwd);

    if (!cwdWorkspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const candidates = project.workspaces;
    const candidatesByName = new Map(
      candidates.map(
        (workspace): [string, Workspace] => {
          const ident = structUtils.convertToIdent(workspace.locator);
          return [structUtils.stringifyIdent(ident), workspace];
        },
      ),
    );

    const workspace = candidatesByName.get(this.workspaceName);

    if (workspace === undefined) {
      const otherNames = Array.from(candidatesByName.keys()).sort();
      throw new UsageError(`Workspace '${this.workspaceName}' not found. Did you mean any of the following:\n  - ${otherNames.join(`\n  - `)}?`);
    }

    return this.cli.run([this.commandName, ...this.args], {cwd: workspace.cwd});
  }
}
