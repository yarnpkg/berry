import {WorkspaceRequiredError}                            from "@yarnpkg/cli";
import {CommandContext, Configuration, Project, Workspace} from "@yarnpkg/core";
import {structUtils}                                       from "@yarnpkg/core";
import {Command, UsageError}                               from "clipanion";

// eslint-disable-next-line arca/no-default-export
export default class WorkspaceCommand extends Command<CommandContext> {
  @Command.String()
  workspaceName!: string;

  @Command.String()
  commandName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  static usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `run a command within the specified workspace`,
    details: `
      > In order to use this command you need to add \`@yarnpkg/plugin-workspace-tools\` to your plugins.

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

  @Command.Path(`workspace`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace: cwdWorkspace} = await Project.find(configuration, this.context.cwd);

    if (!cwdWorkspace)
      throw new WorkspaceRequiredError(this.context.cwd);

    const candidates = project.workspaces;
    const candidatesByName = new Map(
      candidates.map(
        (workspace): [string, Workspace] => {
          const ident = structUtils.convertToIdent(workspace.locator);
          return [structUtils.stringifyIdent(ident), workspace];
        }
      )
    );

    const workspace = candidatesByName.get(this.workspaceName);

    if (workspace === undefined) {
      const otherNames = Array.from(candidatesByName.keys()).sort();
      throw new UsageError(
        `Workspace '${
          this.workspaceName
        }' not found. Did you mean any of the following:\n  - ${otherNames.join(
          "\n  - "
        )}?`
      );
    }

    return this.cli.run([this.commandName, ...this.args], {cwd: workspace.cwd});
  }
}
