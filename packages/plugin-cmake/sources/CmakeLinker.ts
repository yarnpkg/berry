import {Package, Linker, MinimalLinkOptions, Locator, LinkOptions, structUtils} from '@yarnpkg/core';
import {PortablePath, ppath, xfs, Filename}                                     from '@yarnpkg/fslib';

import {UsageError}                                                             from 'clipanion';

import {CmakeInstaller}                                                         from './CmakeInstaller';
import * as folderUtils                                                         from './folderUtils';

export class CmakeLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    if (pkg.linkerName !== `cmake` && pkg.linkerName !== `unknown`)
      return false;

    return true;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    const pathmapFile = folderUtils.getPathmapPath(opts.project.configuration);
    if (!await xfs.existsPromise(pathmapFile))
      throw new UsageError(`The project in ${opts.project.cwd}/package.json doesn't seem to have been installed - running 'yarn install' might help`);

    const pathmap = await xfs.readJsonPromise(pathmapFile);

    const location = pathmap[structUtils.stringifyLocator(locator)];
    if (typeof location === `undefined`)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the install registry - running 'yarn install' might help`);

    return ppath.join(opts.project.cwd, location);
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    const vendorsFolder = opts.project.configuration.get(`cmakeVendorFolder`);

    const relative = ppath.contains(vendorsFolder, location);
    if (relative === null)
      return null;

    const parts = relative.split(ppath.sep);
    if (parts.length === 0)
      return null;

    const metaPath = ppath.join(vendorsFolder, parts[0] as Filename);
    if (!await xfs.existsPromise(metaPath))
      return null;

    const meta = await xfs.readJsonPromise(metaPath);
    return structUtils.parseLocator(meta.locator);
  }

  makeInstaller(opts: LinkOptions) {
    return new CmakeInstaller(opts);
  }
}
