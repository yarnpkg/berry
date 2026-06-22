import {formatUtils}                                     from '@yarnpkg/core';
import {ppath}                                           from '@yarnpkg/fslib';

import {MessageName}                                     from './MessageName';
import {ReportError}                                     from './Report';
import {Resolver, ResolveOptions, MinimalResolveOptions} from './Resolver';
import {Type}                                            from './formatUtils';
import {Descriptor, Locator}                             from './types';

export class RunInstallPleaseResolver implements Resolver {
  private readonly resolver: Resolver;

  constructor(resolver: Resolver) {
    this.resolver = resolver;
  }

  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.supportsDescriptor(descriptor, opts);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.supportsLocator(locator, opts);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.shouldPersistResolution(locator, opts);
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    return this.resolver.bindDescriptor(descriptor, fromLocator, opts);
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions) {
    return this.resolver.getResolutionDependencies(descriptor, opts);
  }

  async getCandidates(descriptor: Descriptor, dependencies: unknown, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`, report => {
      report.reportInfo(MessageName.MISSING_LOCKFILE_ENTRY, `Using package.json from ${formatUtils.applyColor(opts.project.configuration, ppath.resolve(opts.project.topLevelWorkspace.cwd), Type.PATH)}`);
    });
  }

  async getSatisfying(descriptor: Descriptor, dependencies: unknown, locators: Array<Locator>, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`, report => {
      report.reportInfo(MessageName.MISSING_LOCKFILE_ENTRY, `Using package.json from ${formatUtils.applyColor(opts.project.configuration, ppath.resolve(opts.project.topLevelWorkspace.cwd), Type.PATH)}`);
    });
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<never> {
    throw new ReportError(MessageName.MISSING_LOCKFILE_ENTRY, `This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile`, report => {
      report.reportInfo(MessageName.MISSING_LOCKFILE_ENTRY, `Using package.json from ${formatUtils.applyColor(opts.project.configuration, ppath.resolve(opts.project.topLevelWorkspace.cwd), Type.PATH)}`);
    });
  }
}
