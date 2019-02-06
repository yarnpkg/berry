import {Configuration, Cache, Plugin, Project, Locator, MessageName, StreamReport} from '@berry/core';
import {LightReport}                                                               from '@berry/core';
import {ZipFS, xfs}                                                                from '@berry/fslib';
import {posix}                                                                     from 'path';
import {Writable}                                                                  from 'stream';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`cache clean`)
  .describe(`remove the 'unused' packages from the cache`)

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);
    const cache = await Cache.find(configuration);

    const resolutionReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.resolveEverything({lockfileOnly: true, cache, report});
    });

    if (resolutionReport.hasErrors())
      return 1;
    
    const seen = new Set();
    const indirectCache = Object.create(cache);

    indirectCache.fetchPackageFromCache = async (locator: Locator, checksum: string | null, loader?: () => Promise<ZipFS>): Promise<[ZipFS, string]> => {
      seen.add(cache.getLocatorPath(locator));
      return await cache.fetchPackageFromCache(locator, checksum, loader);
    };

    const fetchReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
      await project.fetchEverything({cache: indirectCache, report});
    });

    if (fetchReport.hasErrors())
      return 1;
    
    const unlinkReport = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      for (const entry of await xfs.readdirPromise(cache.cwd)) {
        if (entry === `.gitignore`)
          continue;

        const file = posix.join(cache.cwd, entry);
        if (seen.has(file))
          continue;

        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${entry} seems to be unused`);
        await xfs.unlinkPromise(file);
      }

      const virtualFolder = configuration.get(`virtualFolder`);

      for (const entry of await xfs.readdirPromise(virtualFolder)) {
        const file = posix.join(virtualFolder, entry);

        const relativeTarget = await xfs.readlinkPromise(file);
        const absoluteTarget = posix.resolve(posix.dirname(file), relativeTarget);

        if (xfs.existsSync(absoluteTarget))
          continue;

        report.reportInfo(MessageName.UNUSED_CACHE_ENTRY, `${entry} seems to be unused`);
        await xfs.unlinkPromise(file);
      }
    });

    return 0;
  });
