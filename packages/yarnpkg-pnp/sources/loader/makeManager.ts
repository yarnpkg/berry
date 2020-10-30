import {FakeFS, Filename, NativePath, PortablePath, VirtualFS, npath, ppath, xfs} from '@yarnpkg/fslib';
import fs                                                                         from 'fs';
import {Module}                                                                   from 'module';

import {PnpApi}                                                                   from '../types';

export type ApiMetadata = {
  cache: typeof Module._cache,
  instance: PnpApi,
  stats: fs.Stats,
  lastRefreshCheck: number
};

export type MakeManagerOptions = {
  fakeFs: FakeFS<PortablePath>,
};

export type Manager = ReturnType<typeof makeManager>;

export function makeManager(pnpapi: PnpApi, opts: MakeManagerOptions) {
  const initialApiPath = npath.toPortablePath(pnpapi.resolveToUnqualified(`pnpapi`, null)!);
  const initialApiStats = opts.fakeFs.statSync(npath.toPortablePath(initialApiPath));

  const apiMetadata: Map<PortablePath, ApiMetadata> = new Map([
    [initialApiPath, {
      cache: Module._cache,
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
      console.warn(`[Warning] The runtime detected new informations in a PnP file; reloading the API instance (${npath.fromPortablePath(pnpApiPath)})`);

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
        cache: {},
        instance: loadApiInstance(pnpApiPath),
        stats: opts.fakeFs.statSync(pnpApiPath),
        lastRefreshCheck: Date.now(),
      });
    }

    return apiEntry;
  }

  const findApiPathCache = new Map<PortablePath, PortablePath | null>();

  function addToCacheAndReturn(start: PortablePath, end: PortablePath, target: PortablePath | null) {
    if (target !== null)
      target = VirtualFS.resolveVirtual(target);

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
    const start = ppath.resolve(npath.toPortablePath(modulePath));

    let curr: PortablePath;
    let next = start;

    do {
      curr = next;

      const cached = findApiPathCache.get(curr);
      if (cached !== undefined)
        return addToCacheAndReturn(start, curr, cached);

      const candidate = ppath.join(curr, `.pnp.js` as Filename);
      if (xfs.existsSync(candidate) && xfs.statSync(candidate).isFile())
        return addToCacheAndReturn(start, curr, candidate);

      const cjsCandidate = ppath.join(curr, `.pnp.cjs` as Filename);
      if (xfs.existsSync(cjsCandidate) && xfs.statSync(cjsCandidate).isFile())
        return addToCacheAndReturn(start, curr, cjsCandidate);

      next = ppath.dirname(curr);
    } while (curr !== PortablePath.root);

    return addToCacheAndReturn(start, curr, null);
  }

  function getApiPathFromParent(parent: Module | null | undefined): PortablePath | null {
    if (parent == null)
      return initialApiPath;

    if (typeof parent.pnpApiPath === `undefined`) {
      if (parent.filename !== null) {
        return parent.pnpApiPath = findApiPathFor(parent.filename);
      } else {
        return initialApiPath;
      }
    }

    if (parent.pnpApiPath !== null)
      return parent.pnpApiPath;

    return null;
  }

  return {
    getApiPathFromParent,
    findApiPathFor,
    getApiEntry,
  };
}
