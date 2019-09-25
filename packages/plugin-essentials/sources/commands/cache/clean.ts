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
  @Command.Boolean(`--dry-run`)
  dryRun: boolean = false;

  @Command.Boolean(`--json`)
  json: boolean = false;

  static usage = Command.Usage({
    description: `remove the unused packages from the cache`,
    details: `
      This command will locate the files that aren't used in the current project, and remove them (unless \`--dry-run\` is set).

      If the \`--json\` flag is set the output will follow a JSON-stream output also known as NDJSON (https://github.com/ndjson/ndjson-spec).

      In order to detect whether a file is used or not the command will run a partial install where it will paint the "fetched" packages on top of actually downloading them. Each package in the cache that hasn't been painted during the install will be reported as unused.

      One quirk of this system is that \`yarn cache clean\` cannot be used directly if your cache is used by multiple projects, as it won't be able to detect the files being used by other projects than the current one. The best way to support multiple projects with a single mirror is to use the \`--dry-run\` and \`--json\` flags in order to get the list of files that aren't used by one unique project. After running this command on all your projects, you'll just have to remove the intersection of all those file sets as they'll be guaranteed not to be used by any project.
    `,
    examples: [[
      `Remove all the unused cache files from the current project`,
      `$0 cache clean`,
    ], [
      `Obtain the list of unused files from the current project`,
      `$0 cache clean --dry-run --json`,
    ]],
  });

  @Command.Path(`cache`, `clean`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);
    const cache = await Cache.find(configuration);

    const cacheEntries = new Set<Filename>();

    // We compute the name those packages would have if they were inside the
    // cache. Note that we do this even for packages where it wouldn't make
    // sense (for example we get the cache entry even for workspaces) but it
    // doesn't matter in this case since we only need to know which ones
    // amongst the existing entries aren't used anymore, and such packages
    // would definitely not exist anyway.
    for (const pkg of project.storedPackages.values())
      cacheEntries.add(cache.getLocatorFilename(pkg));

    const cacheFolder = cache.cwd;

    const dirtyPaths: Array<PortablePath> = [];
    const dirtySources: Array<[PortablePath, Set<Filename>]> = [
      [cacheFolder, cacheEntries],
    ];

    for (const [folder, entries] of dirtySources) {
      if (!xfs.existsSync(folder))
        continue;

      for (const entry of await xfs.readdirPromise(folder)) {
        if (PRESERVED_FILES.has(entry))
          continue;
        if (entries.has(entry))
          continue;

        dirtyPaths.push(ppath.resolve(folder, entry));
      }
    }

    const unlinkReport = await StreamReport.start({
      configuration,
      json: this.json,
      stdout: this.context.stdout,
    }, async report => {
      for (const path of dirtyPaths) {
        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${ppath.basename(path)} seems to be unused`);
        report.reportJson({path: NodeFS.fromPortablePath(path)});

        if (!this.dryRun) {
          await xfs.unlinkPromise(path);
        }
      }
    });

    return unlinkReport.exitCode();
  }
}
