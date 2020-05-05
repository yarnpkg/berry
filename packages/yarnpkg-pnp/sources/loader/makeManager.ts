import {FakeFS, Filename, NativePath, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import fs                                                              from 'fs';
import {Module}                                                        from 'module';

import {PnpApi}                                                        from '../types';

export type ApiMetadata = {
  cache: typeof Module._cache,
  instance: PnpApi,
  stats: fs.Stats,
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
    }],
  ]);

  function loadApiInstance(pnpApiPath: PortablePath): PnpApi {
    const nativePath = npath.fromPortablePath(pnpApiPath);

    // @ts-ignore
    const module = new Module(nativePath, null);
    module.load(nativePath);
    return module.exports;
  }

  function refreshApiEntry(pnpApiPath: PortablePath, apiEntry: ApiMetadata) {
    const stats = opts.fakeFs.statSync(pnpApiPath);

    if (stats.mtime > apiEntry.stats.mtime) {
      console.warn(`[Warning] The runtime detected new informations in a PnP file; reloading the API instance (${pnpApiPath})`);

      apiEntry.instance = loadApiInstance(pnpApiPath);
      apiEntry.stats = stats;
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
      });
    }

    return apiEntry;
  }

  function findApiPathFor(modulePath: NativePath) {
    let curr: PortablePath;
    let next = ppath.resolve(npath.toPortablePath(modulePath));

    do {
      curr = next;

      const candidate = ppath.join(curr, `.pnp.js` as Filename);
      if (xfs.existsSync(candidate) && xfs.statSync(candidate).isFile())
        return candidate;

      const cjsCandidate = ppath.join(curr, `.pnp.cjs` as Filename);
      if (xfs.existsSync(cjsCandidate) && xfs.statSync(cjsCandidate).isFile())
        return cjsCandidate;

      next = ppath.dirname(curr);
    } while (curr !== PortablePath.root);

    return null;
  }

  function getApiPathFromParent(parent: Module | null | undefined): PortablePath | null {
    if (parent == null)
      return initialApiPath;

    if (typeof parent.pnpApiPath === `undefined`) {
      if (parent.filename !== null) {
        return findApiPathFor(parent.filename);
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
