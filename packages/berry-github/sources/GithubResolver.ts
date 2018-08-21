import {Resolver}                            from '@berry/core';
import {httpUtils, structUtils}              from '@berry/core';
import {Ident, Descriptor, Locator, Package} from '@berry/core';

import * as githubUtils                      from './githubUtils';

export class GithubResolver implements Resolver {
  supports(descriptor: Descriptor): boolean {
    return githubUtils.isGithubUrl(descriptor.range);
  }

  async getCandidates(descriptor: Descriptor): Promise<Array<string>> {
    return [descriptor.range];
  }

  async resolve(locator: Locator): Promise<Package> {
    const dependencies = new Map();
    const peerDependencies = new Map();

    return {... locator, dependencies, peerDependencies};
  }
}
