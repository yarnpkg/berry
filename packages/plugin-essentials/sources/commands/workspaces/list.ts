import {BaseCommand}                                                                        from '@yarnpkg/cli';

import {Configuration, Manifest, Project, StreamReport, structUtils, Descriptor, Workspace} from '@yarnpkg/core';
import {PortablePath}                                                                       from '@yarnpkg/fslib';
import {Command, Usage}                                                                     from 'clipanion';

import {printTree, TreeNode}                                                                from '../why';

type WorkspaceTree = [Workspace, Array<WorkspaceTree>];

/**
 * The Workspace information tree.
 *
 * Outputted by the `yarn workspaces list --tree --json` command.
 */
export type WorkspaceInfoTree = [{
  /**
   * The location of the workspace, relative to the root of the project.
   */
  location: PortablePath,

  /**
   * The name of the workspace, declared in the manifest.
   */
  name: string | null,

  /**
   * Extra information about the workspace.
   *
   * Only present if the `-v,--verbose` flag is used.
   */
  extra?: {
    /**
     * The workspace dependencies of a workspace, represented as paths relative to the root of the project.
     */
    workspaceDependencies: Array<PortablePath>,

    /**
     * The mismatched workspace dependencies of a workspace, represented as stringified descriptors.
     *
     * A workspace dependency is considered mismatched when the project doesn't contain the specified descriptor, but it contains the corresponding ident.
     */
    mismatchedWorkspaceDependencies: Array<string>
  },
}, Array<WorkspaceInfoTree>];

// eslint-disable-next-line arca/no-default-export
export default class WorkspacesListCommand extends BaseCommand {
  @Command.Boolean(`-v,--verbose`)
  verbose: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  @Command.Boolean(`-t,--tree`)
  tree: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Workspace-related commands`,
    description: `list all available workspaces`,
    details: `
      This command will print the list of all workspaces in the project.

      If the \`-t,--tree\` flag is set, the output will represent a workspace tree, whose keys represent the names of the workspaces.

      If both the \`-t,--tree\` and \`--json\` flags are set, the output will represent a workspace tree, following the JSON format.

      If both the \`-v,--verbose\` and \`--json\` options are set, Yarn will also return the cross-dependencies between each workspaces (useful when you wish to automatically generate Buck / Bazel rules).

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).
    `,
  });

  @Command.Path(`workspaces`, `list`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      includeFooter: false,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      const {verbose} = this;

      const {infoTree} = (function buildWorkspaceTree(workspace: Workspace) {
        const workspaceTree: WorkspaceTree = [workspace, []];
        const infoTree: WorkspaceInfoTree = [getWorkspaceInfo(workspace, project, {verbose}), []];

        for (const workspaceCwd of workspace.workspacesCwds) {
          const matchingWorkspace = project.tryWorkspaceByCwd(workspaceCwd);

          if (!matchingWorkspace)
            continue;

          const trees = buildWorkspaceTree(matchingWorkspace);

          workspaceTree[1].push(trees.workspaceTree);
          infoTree[1].push(trees.infoTree);
        }

        return {workspaceTree, infoTree};
      })(project.topLevelWorkspace);

      if (this.tree) {
        report.reportJson(infoTree);

        if (!this.json) {
          const treeObject = (function buildTreeObject(infoTree: WorkspaceInfoTree, treeObject: TreeNode = {}) {
            const [{name}, subtrees] = infoTree;

            const prettyName = name !== null
              ? structUtils.prettyIdent(configuration, structUtils.parseIdent(name))
              : `null`;

            treeObject[prettyName] = {};

            for (const subtree of subtrees)
              buildTreeObject(subtree, treeObject[prettyName]);

            return treeObject;
          })(infoTree);

          printTree(this.context.stdout, treeObject);
        }
      } else {
        const flatInfoTree: Array<WorkspaceInfoTree[0]> = infoTree.flat(Infinity);

        for (const info of flatInfoTree) {
          report.reportInfo(null, `${info.location}`);
          report.reportJson(info);
        }
      }
    });

    return report.exitCode();
  }
}

function getWorkspaceInfo(workspace: Workspace, project: Project, {verbose}: {verbose: boolean}) {
  const {manifest} = workspace;

  let extra;
  if (verbose) {
    const workspaceDependencies = new Set<Workspace>();
    const mismatchedWorkspaceDependencies = new Set<Descriptor>();

    for (const dependencyType of Manifest.hardDependencies) {
      for (const [identHash, descriptor]  of manifest.getForScope(dependencyType)) {
        const matchingWorkspace = project.tryWorkspaceByDescriptor(descriptor);

        if (matchingWorkspace === null) {
          if (project.workspacesByIdent.has(identHash)) {
            mismatchedWorkspaceDependencies.add(descriptor);
          }
        } else {
          workspaceDependencies.add(matchingWorkspace);
        }
      }
    }

    extra = {
      workspaceDependencies: Array.from(workspaceDependencies).map(workspace => {
        return workspace.relativeCwd;
      }),

      mismatchedWorkspaceDependencies: Array.from(mismatchedWorkspaceDependencies).map(descriptor => {
        return structUtils.stringifyDescriptor(descriptor);
      }),
    };
  }

  return {
    location: workspace.relativeCwd,

    name: manifest.name
      ? structUtils.stringifyIdent(manifest.name)
      : null,

    ...extra,
  } as WorkspaceInfoTree[0];
}
