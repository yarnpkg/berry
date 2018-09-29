import {relative}                                                                       from 'path';

import {Project, Descriptor}                                                            from '@berry/core';
import {structUtils}                                                                    from '@berry/core';

import {PackageInformationStores, LocationBlacklist, TemplateReplacements, PnpSettings} from './types';

export async function extractPnpSettings(project: Project): Promise<PnpSettings> {
  const packageInformationStores: PackageInformationStores = new Map();
  const blacklistedLocations: LocationBlacklist = new Set();
  const replacements: TemplateReplacements = {};

  replacements.SHEBANG = project.configuration.pnpShebang;
  replacements.IGNORE_PATTERN = JSON.stringify(project.configuration.pnpIgnorePattern);

  function normalizeDirectoryPath(folder: string) {
    let relativeFolder = relative(project.cwd, folder);

    if (!relativeFolder.match(/^\.{0,2}\//))
      relativeFolder = `./${relativeFolder}`;

    return relativeFolder.replace(/\/?$/, '/');
  }

  async function visit(descriptors: Map<string, Descriptor>, parentLocator: string) {
    const packageDependencies = new Map();

    for (const descriptor of descriptors.values()) {
      const locatorHash = project.storedResolutions.get(descriptor.descriptorHash);

      if (!locatorHash)
        throw new Error(`Expected to find a resolution, but none found`);

      const pkg = project.storedPackages.get(locatorHash);

      if (!pkg)
        throw new Error(`Expected to find a package, but none found`);

      const requirableName = structUtils.requirableIdent(pkg);

      packageDependencies.set(requirableName, pkg.reference);
    }

    for (const descriptor of descriptors.values()) {
      const locatorHash = project.storedResolutions.get(descriptor.descriptorHash);

      if (!locatorHash)
        throw new Error(`Expected to find a resolution, but none found`);

      const pkg = project.storedPackages.get(locatorHash);

      if (!pkg)
        throw new Error(`Expected to find a package, but none found`);

      const location = project.storedLocations.get(pkg.locatorHash);

      if (!location)
        throw new Error(`Expected to find a location, but none found`);

      const requirableName = structUtils.requirableIdent(pkg);

      let packageInformationStore = packageInformationStores.get(requirableName);

      if (!packageInformationStore)
        packageInformationStores.set(requirableName, packageInformationStore = new Map());

      let packageInformation = packageInformationStore.get(pkg.reference);

      if (packageInformation)
        continue;

      packageInformation = {
        packageLocation: normalizeDirectoryPath(location),
        packageDependencies: new Map(),
      };

      packageInformationStore.set(pkg.reference, packageInformation);
      packageInformation.packageDependencies = await visit(pkg.dependencies, pkg.locatorHash);

      if (!packageInformation.packageDependencies.has(requirableName)) {
        packageInformation.packageDependencies.set(requirableName, pkg.reference);
      }
    }

    return packageDependencies;
  }

  for (const workspace of project.workspacesByLocator.values()) {
    const requirableName = workspace.cwd !== project.cwd
      ? structUtils.requirableIdent(workspace.locator)
      : null;

    let packageInformationStore = packageInformationStores.get(requirableName);

    if (!packageInformationStore)
      packageInformationStores.set(requirableName, packageInformationStore = new Map());

    const reference = workspace.cwd !== project.cwd
      ? workspace.locator.reference
      : null;

    packageInformationStore.set(reference, {
      packageLocation: normalizeDirectoryPath(workspace.cwd),
      packageDependencies: await visit(workspace.dependencies, workspace.locator.locatorHash),
    });
  }

  return {packageInformationStores, blacklistedLocations, replacements};
}
