import {Descriptor, FetchResult, formatUtils, Installer, InstallPackageExtraApi, Linker, LinkOptions, LinkType, Locator, LocatorHash, Manifest, MessageName, MinimalLinkOptions, Package, Project, miscUtils, structUtils, WindowsLinkType} from '@yarnpkg/core';
import {Dirent, Filename, PortablePath, setupCopyIndex, ppath, xfs}                                                                                                                                                                         from '@yarnpkg/fslib';
import {jsInstallUtils}                                                                                                                                                                                                                     from '@yarnpkg/plugin-pnp';
import {UsageError}                                                                                                                                                                                                                         from 'clipanion';

export type PnpmCustomData = {
  locatorByPath: Map<PortablePath, string>;
  pathsByLocator: Map<LocatorHash, {
    packageLocation: PortablePath;
    dependenciesLocation: PortablePath | null;
  }>;
};

export class PnpmLinker implements Linker {
  getCustomDataKey() {
    return JSON.stringify({
      name: `PnpmLinker`,
      version: 3,
    });
  }

  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return this.isEnabled(opts);
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    if (!this.isEnabled(opts))
      throw new Error(`Assertion failed: Expected the pnpm linker to be enabled`);

    const customDataKey = this.getCustomDataKey();
    const customData = opts.project.linkersCustomData.get(customDataKey) as PnpmCustomData | undefined;
    if (!customData)
      throw new UsageError(`The project in ${formatUtils.pretty(opts.project.configuration, `${opts.project.cwd}/package.json`, formatUtils.Type.PATH)} doesn't seem to have been installed - running an install there might help`);

    const packagePaths = customData.pathsByLocator.get(locator.locatorHash);
    if (typeof packagePaths === `undefined`)
      throw new UsageError(`Couldn't find ${structUtils.prettyLocator(opts.project.configuration, locator)} in the currently installed pnpm map - running an install might help`);

    return packagePaths.packageLocation;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator | null> {
    if (!this.isEnabled(opts))
      return null;

    const customDataKey = this.getCustomDataKey();
    const customData = opts.project.linkersCustomData.get(customDataKey) as any;
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
  private readonly indexFolderPromise: Promise<PortablePath>;

  constructor(private opts: LinkOptions) {
    this.indexFolderPromise = setupCopyIndex(xfs, {
      indexPath: ppath.join(opts.project.configuration.get(`globalFolder`), `index` as Filename),
    });
  }

  private customData: PnpmCustomData = {
    pathsByLocator: new Map(),
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
    const packageLocation = ppath.resolve(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);

    const dependenciesLocation = this.opts.project.tryWorkspaceByLocator(pkg)
      ? ppath.join(packageLocation, Filename.nodeModules)
      : null;

    this.customData.pathsByLocator.set(pkg.locatorHash, {
      packageLocation,
      dependenciesLocation,
    });

    return {
      packageLocation,
      buildDirective: null,
    };
  }

  async installPackageHard(pkg: Package, fetchResult: FetchResult, api: InstallPackageExtraApi) {
    const packagePaths = getPackagePaths(pkg, {project: this.opts.project});
    const packageLocation = packagePaths.packageLocation;

    this.customData.locatorByPath.set(packageLocation, structUtils.stringifyLocator(pkg));
    this.customData.pathsByLocator.set(pkg.locatorHash, packagePaths);

    api.holdFetchResult(this.asyncActions.set(pkg.locatorHash, async () => {
      await xfs.mkdirPromise(packageLocation, {recursive: true});

      // Copy the package source into the <root>/n_m/.store/<hash> directory, so
      // that we can then create symbolic links to it later.
      await xfs.copyPromise(packageLocation, fetchResult.prefixPath, {
        baseFs: fetchResult.packageFs,
        overwrite: false,
        linkStrategy: {
          type: `HardlinkFromIndex`,
          indexPath: await this.indexFolderPromise,
          autoRepair: true,
        },
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
      packageLocation,
      buildDirective: buildScripts,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnpm`)
      return;

    // We don't install those packages at all, because they can't be used anyway
    if (!isPnpmVirtualCompatible(locator, {project: this.opts.project}))
      return;

    const packagePaths = this.customData.pathsByLocator.get(locator.locatorHash);
    if (typeof packagePaths === `undefined`)
      throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(locator)})`);

    const {
      dependenciesLocation,
    } = packagePaths;

    if (!dependenciesLocation)
      return;

    this.asyncActions.reduce(locator.locatorHash, async action => {
      await xfs.mkdirPromise(dependenciesLocation, {recursive: true});

      // Retrieve what's currently inside the package's true nm folder. We
      // will use that to figure out what are the extraneous entries we'll
      // need to remove.
      const initialEntries = await getNodeModulesListing(dependenciesLocation);
      const extraneous = new Map(initialEntries);

      const concurrentPromises: Array<Promise<void>> = [action];

      const installDependency = (descriptor: Descriptor, dependency: Locator) => {
        // Downgrade virtual workspaces (cf isPnpmVirtualCompatible's documentation)
        let targetDependency = dependency;
        if (!isPnpmVirtualCompatible(dependency, {project: this.opts.project})) {
          this.opts.report.reportWarningOnce(MessageName.UNNAMED, `The pnpm linker doesn't support providing different versions to workspaces' peer dependencies`);
          targetDependency = structUtils.devirtualizeLocator(dependency);
        }

        const depSrcPaths = this.customData.pathsByLocator.get(targetDependency.locatorHash);
        if (typeof depSrcPaths === `undefined`)
          throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(dependency)})`);

        const name = structUtils.stringifyIdent(descriptor) as PortablePath;
        const depDstPath = ppath.join(dependenciesLocation, name);

        const depLinkPath = ppath.relative(ppath.dirname(depDstPath), depSrcPaths.packageLocation);

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


          if (process.platform == `win32` && this.opts.project.configuration.get(`winLinkType`) === WindowsLinkType.JUNCTIONS) {
            await xfs.symlinkPromise(depSrcPaths.packageLocation, depDstPath, `junction`);
          } else {
            await xfs.symlinkPromise(depLinkPath, depDstPath);
          }
        }));
      };

      let hasExplicitSelfDependency = false;
      for (const [descriptor, dependency] of dependencies) {
        if (descriptor.identHash === locator.identHash)
          hasExplicitSelfDependency = true;

        installDependency(descriptor, dependency);
      }

      if (!hasExplicitSelfDependency && !this.opts.project.tryWorkspaceByLocator(locator))
        installDependency(structUtils.convertLocatorToDescriptor(locator), locator);

      concurrentPromises.push(cleanNodeModules(dependenciesLocation, extraneous));

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
      let extraneous: Set<Filename>;
      try {
        extraneous = new Set(await xfs.readdirPromise(storeLocation));
      } catch {
        extraneous = new Set();
      }

      for (const {dependenciesLocation} of this.customData.pathsByLocator.values()) {
        if (!dependenciesLocation)
          continue;

        const subpath = ppath.contains(storeLocation, dependenciesLocation);
        if (subpath === null)
          continue;

        const [storeEntry] = subpath.split(ppath.sep);
        extraneous.delete(storeEntry as Filename);
      }

      await Promise.all([...extraneous].map(async extraneousEntry => {
        await xfs.removePromise(ppath.join(storeLocation, extraneousEntry));
      }));
    }

    // Wait for the package installs to catch up
    await this.asyncActions.wait();

    await removeIfEmpty(storeLocation);
    if (this.opts.project.configuration.get(`nodeLinker`) !== `node-modules`)
      await removeIfEmpty(getNodeModulesLocation(this.opts.project));

    return {
      customData: this.customData,
    };
  }
}

function getNodeModulesLocation(project: Project) {
  return ppath.join(project.cwd, Filename.nodeModules);
}

function getStoreLocation(project: Project) {
  return ppath.join(getNodeModulesLocation(project), `.store` as Filename);
}

function getPackagePaths(locator: Locator, {project}: {project: Project}) {
  const pkgKey = structUtils.slugifyLocator(locator);
  const storeLocation = getStoreLocation(project);

  const packageLocation = ppath.join(storeLocation, pkgKey, `package` as Filename);
  const dependenciesLocation = ppath.join(storeLocation, pkgKey, Filename.nodeModules);

  return {packageLocation, dependenciesLocation};
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
