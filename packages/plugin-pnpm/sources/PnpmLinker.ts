import {Descriptor, FetchResult, formatUtils, Installer, InstallPackageExtraApi, Linker, LinkOptions, LinkType, Locator, LocatorHash, Manifest, MessageName, MinimalLinkOptions, Package, Project, miscUtils, structUtils} from '@yarnpkg/core';
import {Dirent, Filename, PortablePath, ppath, xfs}                                                                                                                                                                        from '@yarnpkg/fslib';
import {jsInstallUtils}                                                                                                                                                                                                    from '@yarnpkg/plugin-pnp';
import {UsageError}                                                                                                                                                                                                        from 'clipanion';

export type PnpmCustomData = {
  pathByLocator: Map<LocatorHash, PortablePath>;
  locatorByPath: Map<PortablePath, string>;
};

export class PnpmLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return this.isEnabled(opts);
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    if (!this.isEnabled(opts))
      throw new Error(`Assertion failed: Expected the pnpm linker to be enabled`);

    const customDataKey = getCustomDataKey();
    const customData = opts.project.installersCustomData.get(customDataKey) as PnpmCustomData | undefined;
    if (!customData)
      throw new UsageError(`The project in ${formatUtils.pretty(opts.project.configuration, `${opts.project.cwd}/package.json`, formatUtils.Type.PATH)} doesn't seem to have been installed - running an install there might help`);

    const packageLocation = customData.pathByLocator.get(locator.locatorHash);
    if (typeof packageLocation === `undefined`)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed pnpm map - running an install might help`);

    return packageLocation;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator | null> {
    if (!this.isEnabled(opts))
      return null;

    const customDataKey = getCustomDataKey();
    const customData = opts.project.installersCustomData.get(customDataKey) as any;
    if (!customData)
      throw new UsageError(`The project in ${formatUtils.pretty(opts.project.configuration, `${opts.project.cwd}/package.json`, formatUtils.Type.PATH)} doesn't seem to have been installed - running an install there might help`);

    const nmRootLocation = location.match(/(^.*\/node_modules\/(@[^/]*\/)?[^/]+)(\/.*$)/);
    if (nmRootLocation) {
      const nmLocator = customData.locatorByPath.get(nmRootLocation[1]);
      if (nmLocator) {
        return nmLocator;
      }
    }

    let nextPath = location;
    let currentPath = location;
    do {
      currentPath = nextPath;
      nextPath = ppath.dirname(currentPath);

      const locator = customData.locatorByPath.get(currentPath);
      if (locator) {
        return locator;
      }
    } while (nextPath !== currentPath);

    return null;
  }

  makeInstaller(opts: LinkOptions) {
    return new PnpmInstaller(opts);
  }

  private isEnabled(opts: MinimalLinkOptions) {
    return opts.project.configuration.get(`nodeLinker`) === `pnpm`;
  }
}

class PnpmInstaller implements Installer {
  private readonly asyncActions = new miscUtils.AsyncActions(10);

  constructor(private opts: LinkOptions) {
    // Nothing to do
  }

  getCustomDataKey() {
    return getCustomDataKey();
  }

  private customData: PnpmCustomData = {
    pathByLocator: new Map(),
    locatorByPath: new Map(),
  };

  attachCustomData(customData: any) {
    // We don't want to attach the data because it's only used in the Linker and we'll recompute it anyways in the Installer,
    // it needs to be invalidated because otherwise we'll never prune the store or we might run into various issues.
  }

  async installPackage(pkg: Package, fetchResult: FetchResult, api: InstallPackageExtraApi) {
    switch (pkg.linkType) {
      case LinkType.SOFT: return this.installPackageSoft(pkg, fetchResult, api);
      case LinkType.HARD: return this.installPackageHard(pkg, fetchResult, api);
    }

    throw new Error(`Assertion failed: Unsupported package link type`);
  }

  async installPackageSoft(pkg: Package, fetchResult: FetchResult, api: InstallPackageExtraApi) {
    const pkgPath = ppath.resolve(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);
    this.customData.pathByLocator.set(pkg.locatorHash, pkgPath);

    return {
      packageLocation: pkgPath,
      buildDirective: null,
    };
  }

  async installPackageHard(pkg: Package, fetchResult: FetchResult, api: InstallPackageExtraApi) {
    const pkgPath = getPackageLocation(pkg, {project: this.opts.project});

    this.customData.locatorByPath.set(pkgPath, structUtils.stringifyLocator(pkg));
    this.customData.pathByLocator.set(pkg.locatorHash, pkgPath);

    api.holdFetchResult(this.asyncActions.set(pkg.locatorHash, async () => {
      await xfs.mkdirPromise(pkgPath, {recursive: true});

      // Copy the package source into the <root>/n_m/.store/<hash> directory, so
      // that we can then create symbolic links to it later.
      await xfs.copyPromise(pkgPath, fetchResult.prefixPath, {
        baseFs: fetchResult.packageFs,
        overwrite: false,
      });
    }));

    const isVirtual = structUtils.isVirtualLocator(pkg);
    const devirtualizedLocator: Locator = isVirtual ? structUtils.devirtualizeLocator(pkg) : pkg;

    const buildConfig = {
      manifest: await Manifest.tryFind(fetchResult.prefixPath, {baseFs: fetchResult.packageFs}) ?? new Manifest(),
      misc: {
        hasBindingGyp: jsInstallUtils.hasBindingGyp(fetchResult),
      },
    };

    const dependencyMeta = this.opts.project.getDependencyMeta(devirtualizedLocator, pkg.version);
    const buildScripts = jsInstallUtils.extractBuildScripts(pkg, buildConfig, dependencyMeta, {configuration: this.opts.project.configuration, report: this.opts.report});

    return {
      packageLocation: pkgPath,
      buildDirective: buildScripts,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnpm`)
      return;

    // We don't install those packages at all, because they can't be used anyway
    if (!isPnpmVirtualCompatible(locator, {project: this.opts.project}))
      return;

    this.asyncActions.reduce(locator.locatorHash, async action => {
      // Wait that the package is properly installed before starting to copy things into it
      await action;

      const pkgPath = this.customData.pathByLocator.get(locator.locatorHash);
      if (typeof pkgPath === `undefined`)
        throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(locator)})`);

      const nmPath = ppath.join(pkgPath, Filename.nodeModules);

      const concurrentPromises: Array<Promise<void>> = [];

      // Retrieve what's currently inside the package's true nm folder. We
      // will use that to figure out what are the extraneous entries we'll
      // need to remove.
      const extraneous = await getNodeModulesListing(nmPath);

      for (const [descriptor, dependency] of dependencies) {
        // Downgrade virtual workspaces (cf isPnpmVirtualCompatible's documentation)
        let targetDependency = dependency;
        if (!isPnpmVirtualCompatible(dependency, {project: this.opts.project})) {
          this.opts.report.reportWarning(MessageName.UNNAMED, `The pnpm linker doesn't support providing different versions to workspaces' peer dependencies`);
          targetDependency = structUtils.devirtualizeLocator(dependency);
        }

        const depSrcPath = this.customData.pathByLocator.get(targetDependency.locatorHash);
        if (typeof depSrcPath === `undefined`)
          throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(dependency)})`);

        const name = structUtils.stringifyIdent(descriptor) as PortablePath;
        const depDstPath = ppath.join(nmPath, name);

        const depLinkPath = ppath.relative(ppath.dirname(depDstPath), depSrcPath);

        const existing = extraneous.get(name);
        extraneous.delete(name);

        concurrentPromises.push(Promise.resolve().then(async () => {
          // No need to update the symlink if it's already the correct one
          if (existing) {
            if (existing.isSymbolicLink() && await xfs.readlinkPromise(depDstPath) === depLinkPath) {
              return;
            } else {
              await xfs.removePromise(depDstPath);
            }
          }

          await xfs.mkdirpPromise(ppath.dirname(depDstPath));

          if (process.platform == `win32`) {
            await xfs.symlinkPromise(depSrcPath, depDstPath, `junction`);
          } else {
            await xfs.symlinkPromise(depLinkPath, depDstPath);
          }
        }));
      }

      concurrentPromises.push(cleanNodeModules(nmPath, extraneous));

      await Promise.all(concurrentPromises);
    });
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
    throw new Error(`External dependencies haven't been implemented for the pnpm linker`);
  }

  async finalizeInstall() {
    const storeLocation = getStoreLocation(this.opts.project);

    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnpm`) {
      await xfs.removePromise(storeLocation);
    } else {
      const removals: Array<Promise<void>> = [];

      const expectedEntries = new Set<Filename>();
      for (const packageLocation of this.customData.pathByLocator.values()) {
        const subpath = ppath.contains(storeLocation, packageLocation);
        if (subpath !== null) {
          const [storeEntry, /* Filename.nodeModules */, ...identComponents] = subpath.split(ppath.sep);
          expectedEntries.add(storeEntry as Filename);

          const storeEntryPath = ppath.join(storeLocation, storeEntry as Filename);

          removals.push(xfs.readdirPromise(storeEntryPath)
            .then(entries => {
              return Promise.all(entries.map(async entry => {
                const p = ppath.join(storeEntryPath, entry);
                if (entry === Filename.nodeModules) {
                  const extraneous = await getNodeModulesListing(p);
                  extraneous.delete(identComponents.join(ppath.sep) as PortablePath);
                  return cleanNodeModules(p, extraneous);
                } else {
                  return xfs.removePromise(p);
                }
              }));
            })
            .catch(error => {
              if (error.code !== `ENOENT`) {
                throw error;
              }
            }) as Promise<void>);
        }
      }

      let storeRecords: Array<Filename>;
      try {
        storeRecords = await xfs.readdirPromise(storeLocation);
      } catch {
        storeRecords = [];
      }

      for (const record of storeRecords)
        if (!expectedEntries.has(record))
          removals.push(xfs.removePromise(ppath.join(storeLocation, record)));

      await Promise.all(removals);
    }

    // Wait for the package installs to catch up
    await this.asyncActions.wait(),

    await removeIfEmpty(storeLocation);
    await removeIfEmpty(getNodeModulesLocation(this.opts.project));

    return {
      customData: this.customData,
    };
  }
}

function getCustomDataKey() {
  return JSON.stringify({
    name: `PnpmInstaller`,
    version: 2,
  });
}

function getNodeModulesLocation(project: Project) {
  return ppath.join(project.cwd, Filename.nodeModules);
}

function getStoreLocation(project: Project) {
  return ppath.join(getNodeModulesLocation(project), `.store` as Filename);
}

function getPackageLocation(locator: Locator, {project}: {project: Project}) {
  const pkgKey = structUtils.slugifyLocator(locator);
  const prefixPath = structUtils.getIdentVendorPath(locator);
  const pkgPath = ppath.join(getStoreLocation(project), pkgKey, prefixPath);

  return pkgPath;
}

function isPnpmVirtualCompatible(locator: Locator, {project}: {project: Project}) {
  // The pnpm install strategy has a limitation: because Node would always
  // resolve symbolic path to their true location, and because we can't just
  // copy-paste workspaces like we do with normal dependencies, we can't give
  // multiple dependency sets to the same workspace based on how its peer
  // dependencies are satisfied by its dependents (like PnP can).
  //
  // For this reason, we ignore all virtual instances of workspaces, and
  // instead have to rely on the user being aware of this caveat.
  //
  // TODO: Perhaps we could implement an error message when we detect multiple
  // sets in a way that can't be reproduced on disk?

  return !structUtils.isVirtualLocator(locator) || !project.tryWorkspaceByLocator(locator);
}

async function getNodeModulesListing(nmPath: PortablePath) {
  const listing = new Map<PortablePath, Dirent>();

  let fsListing: Array<Dirent> = [];
  try {
    fsListing = await xfs.readdirPromise(nmPath, {withFileTypes: true});
  } catch (err) {
    if (err.code !== `ENOENT`) {
      throw err;
    }
  }

  try {
    for (const entry of fsListing) {
      if (entry.name.startsWith(`.`))
        continue;

      if (entry.name.startsWith(`@`)) {
        const scopeListing = await xfs.readdirPromise(ppath.join(nmPath, entry.name), {withFileTypes: true});
        if (scopeListing.length === 0) {
          listing.set(entry.name, entry);
        } else {
          for (const subEntry of scopeListing) {
            listing.set(`${entry.name}/${subEntry.name}` as PortablePath, subEntry);
          }
        }
      } else {
        listing.set(entry.name, entry);
      }
    }
  } catch (err) {
    if (err.code !== `ENOENT`) {
      throw err;
    }
  }

  return listing;
}

async function cleanNodeModules(nmPath: PortablePath, extraneous: Map<PortablePath, Dirent>) {
  const removeNamePromises = [];
  const scopesToRemove = new Set<Filename>();

  for (const name of extraneous.keys()) {
    removeNamePromises.push(xfs.removePromise(ppath.join(nmPath, name)));

    const scope = structUtils.tryParseIdent(name)?.scope;
    if (scope) {
      scopesToRemove.add(`@${scope}` as Filename);
    }
  }

  return Promise.all(removeNamePromises).then(() => Promise.all([...scopesToRemove].map(
    scope => removeIfEmpty(ppath.join(nmPath, scope)),
  ))) as Promise<void>;
}

async function removeIfEmpty(dir: PortablePath) {
  try {
    await xfs.rmdirPromise(dir);
  } catch (error) {
    if (error.code !== `ENOENT` && error.code !== `ENOTEMPTY`) {
      throw error;
    }
  }
}
