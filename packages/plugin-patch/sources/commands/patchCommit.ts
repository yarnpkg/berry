import {BaseCommand, WorkspaceRequiredError}                              from '@yarnpkg/cli';
import {Cache, Configuration, Project, structUtils, execUtils, miscUtils} from '@yarnpkg/core';
import {npath, xfs, Filename, ppath}                                      from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                       from 'clipanion';

import * as patchUtils                                                    from '../patchUtils';

// eslint-disable-next-line arca/no-default-export
export default class PatchCommitCommand extends BaseCommand {
  @Command.String()
  patchFolder!: string;

  static usage: Usage = Command.Usage({
    description: `
      This will turn the folder passed in parameter into a patchfile suitable for consumption with the \`patch:\` protocol.

      Only folders generated through \`yarn patch\` are accepted as valid input for \`yarn patch-commit\`.
    `,
  });

  @Command.Path(`patch-commit`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project, workspace} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.restoreInstallState();

    const folderPath = ppath.resolve(this.context.cwd, npath.toPortablePath(this.patchFolder));
    const metaPath = ppath.join(folderPath, `.yarn-patch.json` as Filename);

    if (!xfs.existsSync(metaPath))
      throw new UsageError(`The argument folder didn't get created by 'yarn patch'`);

    const meta = await xfs.readJsonPromise(metaPath);
    const locator = structUtils.parseLocator(meta.locator, true);

    if (!project.storedPackages.has(locator.locatorHash))
      throw new UsageError(`No package found in the project for the given locator`);

    const originalPath = await patchUtils.extractPackageToDisk(locator, {cache, project});

    const originalPathN = npath.fromPortablePath(originalPath);
    const patchedPathN = npath.fromPortablePath(folderPath);

    let {stdout} = await execUtils.execvp(`git`, [`diff`, `--no-index`, originalPathN, patchedPathN], {
      cwd: this.context.cwd,
    });

    stdout = stdout.replace(new RegExp(miscUtils.escapeRegExp(originalPathN), `g`), ``);
    stdout = stdout.replace(new RegExp(miscUtils.escapeRegExp(patchedPathN), `g`), ``);

    this.context.stdout.write(stdout);
  }
}
