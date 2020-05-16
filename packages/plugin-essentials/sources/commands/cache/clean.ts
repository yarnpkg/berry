import {BaseCommand}                        from '@yarnpkg/cli';
import {Configuration, Cache, StreamReport} from '@yarnpkg/core';
import {xfs}                                from '@yarnpkg/fslib';
import {Command, Usage}                     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class CacheCleanCommand extends BaseCommand {
  @Command.Boolean(`--mirror`)
  mirror: boolean = false;

  @Command.Boolean(`--all`)
  all: boolean = false;

  static usage: Usage = Command.Usage({
    description: `remove the shared cache files`,
    details: `
      This command will remove all the files from the cache.

      By default only the local cache will be cleaned. This behavior can be disabled with the \`--mirror\`, which will lead to the removal of the global cache files instead, or \`--all\` (which will remove both the local and global caches for the current project).
    `,
    examples: [[
      `Remove all the local archives`,
      `$0 cache clean`,
    ], [
      `Remove all the archives stored in the ~/.yarn directory`,
      `$0 cache clean --mirror`,
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
