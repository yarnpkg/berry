import {BaseCommand}                                from '@yarnpkg/cli';
import {Configuration, Cache, Project}              from '@yarnpkg/core';
import {MessageName, StreamReport}                  from '@yarnpkg/core';
import {Filename, NodeFS, xfs, PortablePath, ppath} from '@yarnpkg/fslib';
import {Command}                                    from 'clipanion';

const PRESERVED_FILES = new Set([
  `.gitignore`,
]);

// eslint-disable-next-line arca/no-default-export
export default class CacheCleanCommand extends BaseCommand {
  static usage = Command.Usage({
    description: `remove the shared cache files`,
    details: `
      This command will remove all the files in the shared cache.
    `,
    examples: [[
      `Remove all the shared archives`,
      `$0 cache clean`,
    ]],
  });

  @Command.Path(`cache`, `clean`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const unlinkReport = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      const globalCacheFolder = `${configuration.get(`globalFolder`)}/cache` as PortablePath;
      await xfs.removePromise(globalCacheFolder);
    });

    return unlinkReport.exitCode();
  }
}
