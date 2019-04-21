import {Configuration, Cache, PluginConfiguration, Project}     from '@berry/core';
import {LightReport, MessageName, StreamReport, VirtualFetcher} from '@berry/core';
import {NodeFS, ZipFS, xfs}                                     from '@berry/fslib';
import {posix}                                                  from 'path';
import {Writable}                                               from 'stream';

const PRESERVED_FILES = new Set([
  `.gitignore`,
]);

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`cache clean [--dry-run] [--json]`)
  .describe(`remove the unused packages from the cache`)

  .detail(`
    This command will locate the files that aren't used in the current project, and remove them (unless \`--dry-run\` is set).

    In order to detect whether a file is used or not the command will run a partial install where it will paint the "fetched" packages on top of actually downloading them. Each package in the cache that hasn't been painted during the install will be reported as unused.
    
    One quirk of this system is that \`yarn cache clean\` cannot be used directly if your cache is used by multiple projects, as it won't be able to detect the files being used by other projects than the current one. The best way to support multiple projects with a single mirror is to use the \`--dry-run\` and \`--json\` flags in order to get the list of files that aren't used by one unique project. After running this command on all your projects, you'll just have to remove the intersection of all those file sets as they'll be guaranteed not to be used by any project.
  `)

    .example(
    `Remove all the unused cache files from the current project`,
    `yarn cache clean`,
  )

  .example(
    `Obtain the list of unused files from the current project`,
    `yarn cache clean --dry-run --json`
  )

  .action(async ({cwd, stdout, dryRun, json}: {cwd: string, stdout: Writable, dryRun: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const resolutionReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (resolutionReport.hasErrors())
      return resolutionReport.exitCode();

    const virtualFetcher = new VirtualFetcher();

    const cacheEntries = new Set();
    const virtualEntries = new Set();

    // We compute the name those packages would have if they were inside the
    // cache or a virtual link. Note that we do this even for packages where
    // it wouldn't make sense (for example we get the cache entry even for
    // workspaces) but it doesn't matter in this case since we only need to
    // know which ones amongst the existing entries aren't used anymore, and
    // such packages would definitely not exist anyway.
    for (const pkg of project.storedPackages.values()) {
      cacheEntries.add(cache.getLocatorFilename(pkg));
      virtualEntries.add(virtualFetcher.getLocatorFilename(pkg));
    }

    const cacheFolder = cache.cwd;
    const virtualFolder = configuration.get(`virtualFolder`);

    const dirtyPaths: Array<string> = [];
    const dirtySources = [
      [cacheFolder, cacheEntries],
      [virtualFolder, virtualEntries],
    ];

    for (const [folder, entries] of dirtySources) {
      if (!xfs.existsSync(folder))
        continue;

      for (const entry of await xfs.readdirPromise(folder)) {
        if (PRESERVED_FILES.has(entry))
          continue;
        if (entries.has(entry))
          continue;

        dirtyPaths.push(posix.resolve(folder, entry));
      }
    }

    const unlinkReport = await StreamReport.start({configuration, json, stdout}, async report => {
      for (const path of dirtyPaths) {
        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${posix.basename(path)} seems to be unused`);
        report.reportJson({path: NodeFS.fromPortablePath(path)});

        if (!dryRun) {
          await xfs.unlinkPromise(path);
        }
      }
    });

    return unlinkReport.exitCode();
  });
