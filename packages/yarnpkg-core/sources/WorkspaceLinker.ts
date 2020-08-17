import {PortablePath, ppath}                     from '@yarnpkg/fslib';

import {FetchResult}                             from './Fetcher';
import {Installer}                               from './Installer';
import {Linker, MinimalLinkOptions, LinkOptions} from './Linker';
import {Package, Locator}                        from './types';

/**
 * This linker doesn't do anything! (wat?) Its only purpose is to let the core
 * know about the workspace locations even before someone runs `yarn install`.
 *
 * Without this, people wouldn't be able to run scripts until after the
 * linker artifacts are ready, which would be problematic when working with
 * linkers that don't have any artifact (usually because the dependency tree
 * doesn't contain any package they support).
 */
export class WorkspaceLinker implements Linker {
  supportsPackage(pkg: Package, opts: MinimalLinkOptions) {
    return opts.project.tryWorkspaceByLocator(pkg) !== null;
  }

  async findPackageLocation(locator: Locator, opts: LinkOptions) {
    return opts.project.getWorkspaceByLocator(locator).cwd;
  }

  async findPackageLocator(location: PortablePath, opts: LinkOptions) {
    return opts.project.tryWorkspaceByFilePath(location)?.anchoredLocator ?? null;
  }

  makeInstaller() {
    return new WorkspaceInstaller();
  }
}

class WorkspaceInstaller implements Installer {
  async installPackage(pkg: Package, fetchResult: FetchResult) {
    return {
      packageLocation: ppath.resolve(fetchResult.packageFs.getRealPath(), fetchResult.prefixPath),
      buildDirective: [],
    };
  }

  async attachInternalDependencies() {
    // No need to register anything
  }

  async attachExternalDependents() {
    // No need to register anything
  }

  async finalizeInstall() {
    // No need to persist anything
  }
}
