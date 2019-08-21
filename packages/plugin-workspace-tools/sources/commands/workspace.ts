import {WorkspaceRequiredError}                            from "@berry/cli";
import {CommandContext, Configuration, Project, Workspace} from "@berry/core";
import {structUtils}                                       from "@berry/core";
import {Command, UsageError}                               from "clipanion";

/**
 * Retrieves all the child workspaces of a given root workspace recursively
 *
 * @param rootWorkspace root workspace
 * @param project project
 *
 * @returns all the child workspaces
 */
const getWorkspaceChildrenRecursive = (
  rootWorkspace: Workspace,
  project: Project
): Array<Workspace> => {
  const workspaceList = [];
  for (const childWorkspaceCwd of rootWorkspace.workspacesCwds) {
    const childWorkspace = project.workspacesByCwd.get(childWorkspaceCwd);
    if (childWorkspace) {
      workspaceList.push(
        childWorkspace,
        ...getWorkspaceChildrenRecursive(childWorkspace, project)
      );
    }
  }
  return workspaceList;
};

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
    description: `run a command on the specified namespace`,
    details: `
      This command will run a given sub-command on a single workspace.
    `,
    examples: [
      [
        `Add a package to a single workspace`,
        `yarn workspace components add -D react`,
      ],
      [
        `Run build script on a single workspace`,
        `yarn workspace components run build`,
      ],
    ],
  });

  @Command.Path(`workspace`)
  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    );
    const {project, workspace: cwdWorkspace} = await Project.find(
      configuration,
      this.context.cwd
    );

    if (!cwdWorkspace) throw new WorkspaceRequiredError(this.context.cwd);

    const rootWorkspace = cwdWorkspace;

    const candidates = [
      rootWorkspace,
      ...getWorkspaceChildrenRecursive(rootWorkspace, project),
    ];
    const candiateNames = candidates.map(workspace => {
      const ident = structUtils.convertToIdent(workspace.locator);
      return structUtils.stringifyIdent(ident);
    });

    const workspaceIndex = candiateNames.findIndex(workspaceName => {
      return workspaceName === this.workspaceName;
    });
    const workspace = candidates[workspaceIndex];

    if (workspace === undefined) {
      throw new UsageError(
        `Workspace '${
          this.workspaceName
        }' not found. Did you mean any of the following:\n  - ${candiateNames
          .sort()
          .join("\n  - ")}?`
      );
    }

    return this.cli.run([this.commandName, ...this.args], {
      cwd: workspace.cwd,
      plugins: this.context.plugins,
      stderr: this.context.stderr,
      stdin: this.context.stdin,
      stdout: this.context.stdout,
    });
  }
}
