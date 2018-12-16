import {relative}                                                                       from 'path';

import {LinkOptions}                                                                    from '@berry/core';
import {Project, Descriptor, Locator, Package}                                          from '@berry/core';
import {structUtils}                                                                    from '@berry/core';
import {PackageInformationStores, LocationBlacklist, TemplateReplacements, PnpSettings} from '@berry/pnp';

export async function extractPnpSettings(packageMap: Map<Locator, Package>, api: any, opts: LinkOptions): Promise<PnpSettings> {
  const shebang = opts.project.configuration.pnpShebang;

  const packageInformationStores: PackageInformationStores = new Map();
  const blacklistedLocations: LocationBlacklist = new Set();
  const replacements: TemplateReplacements = {};

  replacements.IGNORE_PATTERN = JSON.stringify(opts.project.configuration.pnpIgnorePattern);

  function normalizeDirectoryPath(folder: string) {
    let relativeFolder = relative(opts.project.cwd, folder);

    if (!relativeFolder.match(/^\.{0,2}\//))
      relativeFolder = `./${relativeFolder}`;

    return relativeFolder.replace(/\/?$/, '/');
  }

  async function extractPackageInformation(pkg: Package) {
    const [packageFs, release] = await api.fetchLocator(pkg);

    try {
      const packageInformation = {
        packageLocation: normalizeDirectoryPath(packageFs.getRealPath()),
        packageDependencies: new Map(),
      };

      for (const dependency of pkg.dependencies.values()) {
        const resolution = await api.resolveDescriptor(dependency);
        packageInformation.packageDependencies.set(structUtils.requirableIdent(resolution), resolution.reference);
      }

      return packageInformation;
    } finally {
      await release();
    }
  }

  for (const pkg of packageMap.values()) {
    const isTopLevelPackage = structUtils.areLocatorsEqual(pkg, opts.project.topLevelWorkspace.anchoredLocator);

    const key1 = isTopLevelPackage ? null : structUtils.requirableIdent(pkg);
    const key2 = isTopLevelPackage ? null : pkg.reference;

    let packageInformationStore = packageInformationStores.get(key1);
    if (!packageInformationStore)
      packageInformationStores.set(key1, packageInformationStore = new Map());

    const packageInformation = await extractPackageInformation(pkg);
    packageInformationStore.set(key2, packageInformation);
  }

  return {shebang, packageInformationStores, blacklistedLocations, replacements};
}
