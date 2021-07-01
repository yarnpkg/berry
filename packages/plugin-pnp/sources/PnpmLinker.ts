import {Descriptor, FetchResult, Installer, Linker, LinkOptions, LinkType, Locator, LocatorHash, MinimalLinkOptions, Package, Project, structUtils} from '@yarnpkg/core';
import {Filename, LinkStrategy, PortablePath, ppath, xfs}                                                                                           from '@yarnpkg/fslib';
import {Dirent}                                                                                                                                     from 'fs';

export class PnpmLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.configuration.get(`nodeLinker`) === `pnpm`;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    // TODO: Support soft linked packages
    return getPackageLocation(locator, {project: opts.project});
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions): Promise<Locator> {
    throw new Error(`Not implemented yet`);
  }

  makeInstaller(opts: LinkOptions) {
    return new PnpmInstaller(opts);
  }
}

class PnpmInstaller implements Installer {
  private locations = new Map<LocatorHash, PortablePath>();
  private pendingCopies: Array<Promise<void>> = [];

  constructor(private opts: LinkOptions) {
    // Nothing to do
  }

  getCustomDataKey() {
    return JSON.stringify({
      name: `PnpmInstaller`,
      version: 1,
    });
  }

  private customData: {} = {};

  attachCustomData(customData: any) {
    this.customData = customData;
  }

  async installPackage(pkg: Package, fetchResult: FetchResult) {
    switch (pkg.linkType) {
      case LinkType.SOFT: return this.installPackageSoft(pkg, fetchResult);
      case LinkType.HARD: return this.installPackageHard(pkg, fetchResult);
    }

    throw new Error(`Assertion failed: Unsupported package link type`);
  }

  async installPackageSoft(pkg: Package, fetchResult: FetchResult) {
    const pkgPath = ppath.resolve(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath);
    this.locations.set(pkg.locatorHash, pkgPath);

    return {
      packageLocation: pkgPath,
      buildDirective: null,
    };
  }

  async installPackageHard(pkg: Package, fetchResult: FetchResult) {
    const pkgPath = getPackageLocation(pkg, {project: this.opts.project});
    this.locations.set(pkg.locatorHash, pkgPath);

    // Copy the package source into the <root>/n_m/.store/<hash> directory, so
    // that we can then create symbolic links to it later.
    this.pendingCopies.push(Promise.resolve().then(async () => {
      await xfs.mkdirPromise(pkgPath, {recursive: true});
      await xfs.copyPromise(pkgPath, fetchResult.prefixPath, {
        baseFs: fetchResult.packageFs,
        overwrite: false,
      });
    }));

    return {
      packageLocation: pkgPath,
      buildDirective: null,
    };
  }

  async attachInternalDependencies(locator: Locator, dependencies: Array<[Descriptor, Locator]>) {
    await Promise.all(this.pendingCopies);

    if (!isPnpmVirtualCompatible(locator, {project: this.opts.project}))
      return;

    const pkgPath = this.locations.get(locator.locatorHash);
    if (typeof pkgPath === `undefined`)
      throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(locator)})`);

    const nmPath = ppath.join(pkgPath, Filename.nodeModules);
    await xfs.mkdirpPromise(nmPath);

    // Retrieve what's currently inside the package's true nm folder. We
    // will use that to figure out what are the extraneous entries we'll
    // need to remove.
    const extraneous = await getNodeModulesListing(nmPath);

    for (const [descriptor, dependency] of dependencies) {
      // Downgrade virtual workspaces (cf isPnpmVirtualCompatible's documentation)
      const targetDependency = !isPnpmVirtualCompatible(dependency, {project: this.opts.project})
        ? structUtils.devirtualizeLocator(dependency)
        : dependency;

      const depSrcPath = this.locations.get(targetDependency.locatorHash);
      if (typeof depSrcPath === `undefined`)
        throw new Error(`Assertion failed: Expected the package to have been registered (${structUtils.stringifyLocator(dependency)})`);

      const name = structUtils.stringifyIdent(descriptor) as PortablePath;
      const depDstPath = ppath.join(nmPath, name);

      const depLinkPath = ppath.relative(ppath.dirname(depDstPath), depSrcPath);

      const existing = extraneous.get(name);
      extraneous.delete(name);

      // No need to update the symlink if it's already the correct one
      if (existing) {
        if (existing.isSymbolicLink() && await xfs.readlinkPromise(depDstPath) === depLinkPath) {
          continue;
        } else {
          await xfs.removePromise(depDstPath);
        }
      }

      await xfs.mkdirpPromise(ppath.dirname(depDstPath));
      await xfs.symlinkPromise(depLinkPath, depDstPath);
    }

    for (const name of extraneous.keys()) {
      await xfs.removePromise(ppath.join(nmPath, name));
    }
  }

  async attachExternalDependents(locator: Locator, dependentPaths: Array<PortablePath>) {
    throw new Error(`External dependencies haven't been implemented for the pnpm linker`);
  }

  async finalizeInstall() {
    if (this.opts.project.configuration.get(`nodeLinker`) !== `pnpm`)
      return undefined;

    return null as any;
  }
}

function getPackageLocation(locator: Locator, {project}: {project: Project}) {
  const pkgKey = structUtils.slugifyLocator(locator);
  const pkgPath = ppath.join(project.cwd, Filename.nodeModules, `.store` as Filename, pkgKey);

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

  try {
    for (const entry of await xfs.readdirPromise(nmPath, {withFileTypes: true})) {
      if (entry.name.startsWith(`.`))
        continue;

      if (entry.name.startsWith(`@`)) {
        for (const subEntry of await xfs.readdirPromise(ppath.join(nmPath, entry.name), {withFileTypes: true})) {
          listing.set(`${entry.name}/${subEntry.name}` as PortablePath, subEntry);
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
