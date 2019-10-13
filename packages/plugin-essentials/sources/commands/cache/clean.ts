import {BaseCommand}                        from '@yarnpkg/cli';
import {Configuration, Cache, StreamReport} from '@yarnpkg/core';
import {PortablePath, xfs}                  from '@yarnpkg/fslib';
import {Command}                            from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class CacheCleanCommand extends BaseCommand {
  @Command.Boolean(`--mirror`)
  mirror: boolean = false;

  @Command.Boolean(`--all`)
  all: boolean = false;

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
    const cache = await Cache.find(configuration);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      const cleanMirror = (this.all || this.mirror) && cache.mirrorCwd !== null;
      const cleanCache = !this.mirror;

      if (cleanMirror)
        await xfs.removePromise(cache.mirrorCwd!);

      if (cleanCache) {
        await xfs.removePromise(cache.cwd);
      }
    });

    return report.exitCode();
  }
}
