import {BaseCommand}                               from '@yarnpkg/cli';
import {Configuration, Cache, StreamReport, Hooks} from '@yarnpkg/core';
import {xfs}                                       from '@yarnpkg/fslib';
import {Command, Option, Usage}                    from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class CacheCleanCommand extends BaseCommand {
  static paths = [
    [`cache`, `clean`],
    [`cache`, `clear`],
  ];

  static usage: Usage = Command.Usage({
    description: `remove the shared cache files`,
    details: `
      This command will remove all the files from the cache.
    `,
    examples: [[
      `Remove all the local archives`,
      `$0 cache clean`,
    ], [
      `Remove all the archives stored in the ~/.yarn directory`,
      `$0 cache clean --mirror`,
    ]],
  });

  mirror = Option.Boolean(`--mirror`, false, {
    description: `Remove the global cache files instead of the local cache files`,
  });

  all = Option.Boolean(`--all`, false, {
    description: `Remove both the global cache files and the local cache files of the current project`,
  });

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const cache = await Cache.find(configuration);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async () => {
      const cleanMirror = (this.all || this.mirror) && cache.mirrorCwd !== null;
      const cleanCache = !this.mirror;

      if (cleanMirror) {
        await xfs.removePromise(cache.mirrorCwd!);

        await configuration.triggerHook((hooks: Hooks) => hooks.cleanGlobalArtifacts, configuration);
      }

      if (cleanCache) {
        await xfs.removePromise(cache.cwd);
      }
    });

    return report.exitCode();
  }
}
