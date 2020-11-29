import {Resolver, ResolveOptions, MinimalResolveOptions, DescriptorHash, structUtils, Descriptor, Locator, Package} from '@yarnpkg/core';

import * as githubUtils                                                                                             from "./githubUtils";

export class GithubResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions): boolean {
    return githubUtils.isGithubUrl(descriptor.range);
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions): boolean {
    return githubUtils.isGithubUrl(locator.reference);
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions): boolean {
    return true;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions): Descriptor {
    return descriptor;
  }

  getResolutionDependencies(descriptor: Descriptor, opts: MinimalResolveOptions): Array<Descriptor> {
    return [githubUtils.makeDescriptor(descriptor)];
  }

  async getCandidates(descriptor: Descriptor, dependencies: Map<DescriptorHash, Package>, opts: ResolveOptions): Promise<Array<Locator>> {
    return [githubUtils.makeLocator(structUtils.convertDescriptorToLocator(descriptor))];
  }

  async getSatisfying(descriptor: Descriptor, references: Array<string>, opts: ResolveOptions): Promise<Array<Locator> | null> {
    return null;
  }

  async resolve(locator: Locator, opts: ResolveOptions): Promise<Package> {
    const sourceLocator = githubUtils.makeLocator(locator);

    const sourcePkg = await opts.resolver.resolve(sourceLocator, opts);

    return {...sourcePkg, ...locator};
  }
}
