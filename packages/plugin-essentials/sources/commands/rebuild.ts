import {BaseCommand, WorkspaceRequiredError}           from '@yarnpkg/cli';
import {Cache, Configuration, IdentHash, StreamReport} from '@yarnpkg/core';
import {ThrowReport, structUtils, Project}             from '@yarnpkg/core';
import {Command, Option, Usage}                        from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class RunCommand extends BaseCommand {
  static paths = [
    [`rebuild`],
  ];

  static usage: Usage = Command.Usage({
    description: `rebuild the project's native packages`,
    details: `
      This command will automatically cause Yarn to forget about previous compilations of the given packages and to run them again.

      Note that while Yarn forgets the compilation, the previous artifacts aren't erased from the filesystem and may affect the next builds (in good or bad). To avoid this, you may remove the .yarn/unplugged folder, or any other relevant location where packages might have been stored (Yarn may offer a way to do that automatically in the future).

      By default all packages will be rebuilt, but you can filter the list by specifying the names of the packages you want to clear from memory.
    `,
    examples: [[
      `Rebuild all packages`,
      `$0 rebuild`,
    ], [
      `Rebuild fsevents only`,
      `$0 rebuild fsevents`,
    ]],
  });

  idents = Option.Rest();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const filteredIdents = new Set<IdentHash>();
    for (const identStr of this.idents)
      filteredIdents.add(structUtils.parseIdent(identStr).identHash);

    await project.restoreInstallState();

    await project.resolveEverything({
      cache,
      report: new ThrowReport(),
    });

    if (filteredIdents.size > 0) {
      for (const pkg of project.storedPackages.values()) {
        if (filteredIdents.has(pkg.identHash)) {
          project.storedBuildState.delete(pkg.locatorHash);
        }
      }
    } else {
      project.storedBuildState.clear();
    }

    const installReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeLogs: !this.context.quiet,
    }, async report => {
      await project.install({cache, report});
    });

    return installReport.exitCode();
  }
}
