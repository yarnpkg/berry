import {BaseCommand, WorkspaceRequiredError}                                                           from '@yarnpkg/cli';
import {Cache, Configuration, Project, StreamReport, ThrowReport, structUtils, IdentHash, LocatorHash} from '@yarnpkg/core';
import {PortablePath, xfs, ppath}                                                                      from '@yarnpkg/fslib';
import {parseSyml}                                                                                     from '@yarnpkg/parsers';
import {Command}                                                                                       from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class RunCommand extends BaseCommand {
  @Command.Rest()
  idents: Array<string> = [];

  static usage = Command.Usage({
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

  @Command.Path(`rebuild`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const filteredIdents = new Set<IdentHash>();
    for (const identStr of this.idents)
      filteredIdents.add(structUtils.parseIdent(identStr).identHash);

    await project.resolveEverything({
      cache,
      report: new ThrowReport(),
    });

    const bstatePath = configuration.get<PortablePath>(`bstatePath`);
    const bstate = xfs.existsSync(bstatePath)
      ? parseSyml(await xfs.readFilePromise(bstatePath, `utf8`)) as {[key: string]: string}
      : {};

    const nextBState = new Map<LocatorHash, string>();

    for (const pkg of project.storedPackages.values()) {
      if (!Object.prototype.hasOwnProperty.call(bstate, pkg.locatorHash))
        continue;

      if (filteredIdents.size === 0 || filteredIdents.has(pkg.identHash))
        continue;

      const buildHash = bstate[pkg.locatorHash];
      nextBState.set(pkg.locatorHash, buildHash);
    }

    if (nextBState.size > 0) {
      const bstatePath = configuration.get<PortablePath>(`bstatePath`);
      const bstateFile = Project.generateBuildStateFile(nextBState, project.storedPackages);

      await xfs.mkdirpPromise(ppath.dirname(bstatePath));
      await xfs.changeFilePromise(bstatePath, bstateFile, {
        automaticNewlines: true,
      });
    } else {
      await xfs.removePromise(bstatePath);
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
