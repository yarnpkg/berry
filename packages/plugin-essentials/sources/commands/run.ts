import {BaseCommand}                       from '@yarnpkg/cli';
import {Configuration, Project, Workspace} from '@yarnpkg/core';
import {scriptUtils, structUtils}          from '@yarnpkg/core';
import {Command, UsageError}               from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class RunCommand extends BaseCommand {
  // This flag is mostly used to give users a way to configure node-gyp. They
  // just have to add it as a top-level workspace.
  @Command.Boolean(`-T,--top-level`, {hidden: true})
  topLevel: boolean = false;

  // The v1 used to print the Yarn version header when using "yarn run", which
  // was messing with the output of things like `--version` & co. We don't do
  // this anymore, but many workflows use `yarn run --silent` to make sure that
  // they don't get this header, and it makes sense to support it as well (even
  // if it's a no-op in our case).
  @Command.Boolean(`--silent`, {hidden: true})
  silent?: boolean;

  @Command.String()
  scriptName!: string;

  @Command.Proxy()
  args: Array<string> = [];

  static usage = Command.Usage({
    description: `run a script defined in the package.json`,
    details: `
      This command will run a tool. The exact tool that will be executed will depend on the current state of your workspace:

      - If the \`scripts\` field from your local package.json contains a matching script name, its definition will get executed.

      - Otherwise, if one of the local workspace's dependencies exposes a binary with a matching name, this binary will get executed.

      - Otherwise, if the specified name contains a colon character and if one of the workspaces in the project contains exactly one script with a matching name, then this script will get executed.

      Whatever happens, the cwd of the spawned process will be the workspace that declares the script (which makes it possible to call commands cross-workspaces using the third syntax).
    `,
    examples: [[
      `Run the tests from the local workspace`,
      `yarn run test`,
    ], [
      `Same thing, but without the "run" keyword`,
      `yarn test`,
    ]],
  });

  @Command.Path(`run`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace, locator} = await Project.find(configuration, this.context.cwd);

    const effectiveLocator = this.topLevel
      ? project.topLevelWorkspace.anchoredLocator
      : locator;

    // First we check to see whether a script exist inside the current package
    // for the given name

    if (await scriptUtils.hasPackageScript(effectiveLocator, this.scriptName, {project}))
      return await scriptUtils.executePackageScript(effectiveLocator, this.scriptName, this.args, {project, stdin: this.context.stdin, stdout: this.context.stdout, stderr: this.context.stderr});

    // If we can't find it, we then check whether one of the dependencies of the
    // current package exports a binary with the requested name

    const binaries = await scriptUtils.getPackageAccessibleBinaries(effectiveLocator, {project});
    const binary = binaries.get(this.scriptName);

    if (binary)
      return await scriptUtils.executePackageAccessibleBinary(effectiveLocator, this.scriptName, this.args, {cwd: this.context.cwd, project, stdin: this.context.stdin, stdout: this.context.stdout, stderr: this.context.stderr});

    // When it fails, we try to check whether it's a global script (ie we look
    // into all the workspaces to find one that exports this script). We only do
    // this if the script name contains a colon character (":"), and we skip
    // this logic if multiple workspaces share the same script name.
    //
    // We also disable this logic for packages coming from third-parties (ie
    // not workspaces). No particular reason except maybe security concerns.

    if (!this.topLevel && workspace && this.scriptName.includes(`:`)) {
      let candidateWorkspaces = await Promise.all(project.workspaces.map(async workspace => {
        return workspace.manifest.scripts.has(this.scriptName) ? workspace : null;
      }));

      let filteredWorkspaces = candidateWorkspaces.filter(workspace => {
        return workspace !== null;
      }) as Array<Workspace>;

      if (filteredWorkspaces.length === 1) {
        return await scriptUtils.executeWorkspaceScript(filteredWorkspaces[0], this.scriptName, this.args, {stdin: this.context.stdin, stdout: this.context.stdout, stderr: this.context.stderr});
      }
    }

    if (this.topLevel) {
      if (this.scriptName === `node-gyp`) {
        throw new UsageError(`Couldn't find a script name "${this.scriptName}" in the top-level (used by ${structUtils.prettyLocator(configuration, locator)}). This typically happens because some package depends on "node-gyp" to build itself, but didn't list it in their dependencies. To fix that, please run "yarn add node-gyp" into your top-level workspace. You also can open an issue on the repository of the specified package to suggest them to use an optional peer dependency.`);
      } else {
        throw new UsageError(`Couldn't find a script name "${this.scriptName}" in the top-level (used by ${structUtils.prettyLocator(configuration, locator)}).`);
      }
    } else {
      throw new UsageError(`Couldn't find a script named "${this.scriptName}".`);
    }
  }
}
