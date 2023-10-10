import {FakeFS, Filename, NativePath, PortablePath, VirtualFS, npath, ppath} from '@yarnpkg/fslib';
import fs                                                                    from 'fs';
import {Module}                                                              from 'module';

import {PnpApi}                                                              from '../types';

export type ApiMetadata = {
  instance: PnpApi;
  stats: fs.Stats;
  lastRefreshCheck: number;
};

export type MakeManagerOptions = {
  fakeFs: FakeFS<PortablePath>;
};

export type Manager = ReturnType<typeof makeManager>;

export function makeManager(pnpapi: PnpApi, opts: MakeManagerOptions) {
  const initialApiPath = npath.toPortablePath(pnpapi.resolveToUnqualified(`pnpapi`, null)!);
  const initialApiStats = opts.fakeFs.statSync(npath.toPortablePath(initialApiPath));

  const apiMetadata: Map<PortablePath, ApiMetadata> = new Map([
    [initialApiPath, {
      instance: pnpapi,
      stats: initialApiStats,
      lastRefreshCheck: Date.now(),
    }],
  ]);

  function loadApiInstance(pnpApiPath: PortablePath): PnpApi {
    const nativePath = npath.fromPortablePath(pnpApiPath);

    // @ts-expect-error
    const module = new Module(nativePath, null);
    // @ts-expect-error
    module.load(nativePath);

    return module.exports;
  }

  function refreshApiEntry(pnpApiPath: PortablePath, apiEntry: ApiMetadata) {
    const timeNow = Date.now();
    if (timeNow - apiEntry.lastRefreshCheck < 500)
      return;

    apiEntry.lastRefreshCheck = timeNow;

    const stats = opts.fakeFs.statSync(pnpApiPath);

    if (stats.mtime > apiEntry.stats.mtime) {
      process.emitWarning(`[Warning] The runtime detected new information in a PnP file; reloading the API instance (${npath.fromPortablePath(pnpApiPath)})`);

      apiEntry.stats = stats;
      apiEntry.instance = loadApiInstance(pnpApiPath);
    }
  }

  function getApiEntry(pnpApiPath: PortablePath, refresh = false) {
    let apiEntry = apiMetadata.get(pnpApiPath);

    if (typeof apiEntry !== `undefined`) {
      if (refresh) {
        refreshApiEntry(pnpApiPath, apiEntry);
      }
    } else {
      apiMetadata.set(pnpApiPath, apiEntry = {
        instance: loadApiInstance(pnpApiPath),
        stats: opts.fakeFs.statSync(pnpApiPath),
        lastRefreshCheck: Date.now(),
      });
    }

    return apiEntry;
  }

  const findApiPathCache = new Map<PortablePath, PortablePath | null>();

  function addToCacheAndReturn(start: PortablePath, end: PortablePath, target: PortablePath | null) {
    if (target !== null) {
      target = VirtualFS.resolveVirtual(target);

      // Ensure that a potentially symlinked PnP API module is instantiated at most once
      target = opts.fakeFs.realpathSync(target);
    }

    let curr: PortablePath;
    let next = start;

    do {
      curr = next;
      findApiPathCache.set(curr, target);
      next = ppath.dirname(curr);
    } while (curr !== end);

    return target;
  }

  function findApiPathFor(modulePath: NativePath) {
    let bestCandidate: {
      packageLocation: NativePath;
      apiPaths: Array<PortablePath>;
    } | null = null;

    for (const [apiPath, apiEntry] of apiMetadata) {
      const locator = apiEntry.instance.findPackageLocator(modulePath);
      if (!locator)
        continue;

      // No need to go the slow way when there's a single API
      if (apiMetadata.size === 1)
        return apiPath;

      const packageInformation = apiEntry.instance.getPackageInformation(locator);
      if (!packageInformation)
        throw new Error(`Assertion failed: Couldn't get package information for '${modulePath}'`);

      if (!bestCandidate)
        bestCandidate = {packageLocation: packageInformation.packageLocation, apiPaths: []};

      if (packageInformation.packageLocation === bestCandidate.packageLocation) {
        bestCandidate.apiPaths.push(apiPath);
      } else if (packageInformation.packageLocation.length > bestCandidate.packageLocation.length) {
        bestCandidate = {packageLocation: packageInformation.packageLocation, apiPaths: [apiPath]};
      }
    }

    if (bestCandidate) {
      if (bestCandidate.apiPaths.length === 1)
        return bestCandidate.apiPaths[0];

      const controlSegment = bestCandidate.apiPaths
        .map(apiPath => `  ${npath.fromPortablePath(apiPath)}`)
        .join(`\n`);

      throw new Error(`Unable to locate pnpapi, the module '${modulePath}' is controlled by multiple pnpapi instances.\nThis is usually caused by using the global cache (enableGlobalCache: true)\n\nControlled by:\n${controlSegment}\n`);
    }

    const start = ppath.resolve(npath.toPortablePath(modulePath));

    let curr: PortablePath;
    let next = start;

    do {
      curr = next;

      const cached = findApiPathCache.get(curr);
      if (cached !== undefined)
        return addToCacheAndReturn(start, curr, cached);

      const cjsCandidate = ppath.join(curr, Filename.pnpCjs);
      if (opts.fakeFs.existsSync(cjsCandidate) && opts.fakeFs.statSync(cjsCandidate).isFile())
        return addToCacheAndReturn(start, curr, cjsCandidate);

      // We still support .pnp.js files to improve multi-project compatibility.
      // TODO: Remove support for .pnp.js files after they stop being used.
      const legacyCjsCandidate = ppath.join(curr, Filename.pnpJs);
      if (opts.fakeFs.existsSync(legacyCjsCandidate) && opts.fakeFs.statSync(legacyCjsCandidate).isFile())
        return addToCacheAndReturn(start, curr, legacyCjsCandidate);

      next = ppath.dirname(curr);
    } while (curr !== PortablePath.root);

    return addToCacheAndReturn(start, curr, null);
  }

  const moduleToApiPathCache = new WeakMap<NodeModule, PortablePath | null>();
  function getApiPathFromParent(parent: NodeModule | null | undefined): PortablePath | null {
    if (parent == null)
      return initialApiPath;

    let apiPath = moduleToApiPathCache.get(parent);
    if (typeof apiPath !== `undefined`)
      return apiPath;

    apiPath = parent.filename ? findApiPathFor(parent.filename) : null;

    moduleToApiPathCache.set(parent, apiPath);
    return apiPath;
  }

  return {
    getApiPathFromParent,
    findApiPathFor,
    getApiEntry,
  };
}
