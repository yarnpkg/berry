import {Resolver, ResolveOptions}            from '@berry/core';
import {httpUtils, structUtils}              from '@berry/core';
import {Ident, Descriptor, Locator, Package} from '@berry/core';

import * as githubUtils                      from './githubUtils';

export class GithubResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: ResolveOptions) {
    return githubUtils.isGithubUrl(descriptor.range);
  }

  supportsLocator(locator: Locator, opts: ResolveOptions) {
    return githubUtils.isGithubUrl(locator.reference);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const dependencies = new Map();
    const peerDependencies = new Map();

    return {... locator, dependencies, peerDependencies};
  }
}
