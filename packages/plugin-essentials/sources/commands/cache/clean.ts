import {Configuration, Cache, Plugin, Project, Locator, MessageName, StreamReport} from '@berry/core';
import {LightReport}                                                               from '@berry/core';
import {ZipFS, xfs}                                                                from '@berry/fslib';
import {posix}                                                                     from 'path';
import {Writable}                                                                  from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`cache clean [--zip-only] [--virtuals-only] [--dry-run] [--json]`)
  .describe(`remove the unused packages from the cache`)

  .detail(`
    This command will locate the files that aren't used in the current project, and remove them (unless \`--dry-run\` is set).

    In order to detect whether a file is used or not the command will run a partial install where it will paint the "fetched" packages on top of actually downloading them. Each package in the cache that hasn't been painted during the install will be reported as unused.
    
    One quirk of this system is that \`yarn cache clean\` cannot be used directly if your cache is used by multiple projects, as it won't be able to detect the files being used by other projects than the current one. The best way to support multiple projects with a single mirror is to use combinations of \`--dry-run\` and \`--json\` together with \`--zip-only\` or \`--virtuals-only\` in order to get the list of files that aren't used by one project. If you do this on all projects that use your cache and delete the intersection of all the results then it should have the right behavior.
  `)

  .example(
    `Removes all the unused cache files from the current project`,
    `yarn cache clean`,
  )

  .example(
    `Obtains the list of unused zip files`,
    `yarn cache clean --zip-only --dry-run --json`
  )

  .action(async ({cwd, stdout, zipOnly, virtualsOnly, dryRun, json}: {cwd: string, stdout: Writable, zipOnly: boolean, virtualsOnly: boolean, dryRun: boolean, json: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const seen = new Set();

    if (!virtualsOnly) {
      const resolutionReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
        await project.resolveEverything({lockfileOnly: true, cache, report});
      });

      if (resolutionReport.hasErrors())
        return 1;
      
      const indirectCache = Object.create(cache);

      indirectCache.fetchPackageFromCache = async (locator: Locator, checksum: string | null, loader?: () => Promise<ZipFS>): Promise<[ZipFS, string]> => {
        seen.add(cache.getLocatorPath(locator));
        return await cache.fetchPackageFromCache(locator, checksum, loader);
      };

      const fetchReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
        await project.fetchEverything({cache: indirectCache, report});
      });

      if (fetchReport.hasErrors()) {
        return 1;
      }
    }
    
    const unlinkReport = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      if (!virtualsOnly) {
        if (xfs.existsSync(cache.cwd)) {
          for (const entry of await xfs.readdirPromise(cache.cwd)) {
            if (entry === `.gitignore`)
              continue;

            const file = posix.join(cache.cwd, entry);
            if (seen.has(file))
              continue;

            report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${entry} seems to be unused`);

            if (!dryRun) {
              await xfs.unlinkPromise(file);
            }
          }
        }
      }

      if (!zipOnly) {
        const virtualFolder = configuration.get(`virtualFolder`);

        if (xfs.existsSync(virtualFolder)) {
          for (const entry of await xfs.readdirPromise(virtualFolder)) {
            const file = posix.join(virtualFolder, entry);

            const relativeTarget = await xfs.readlinkPromise(file);
            const absoluteTarget = posix.resolve(posix.dirname(file), relativeTarget);

            if (xfs.existsSync(absoluteTarget))
              continue;

            report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${entry} seems to be unused`);

            if (!dryRun) {
              await xfs.unlinkPromise(file);
            }
          }
        }
      }
    });

    return unlinkReport.exitCode();
  });
