import {JailFS}                             from '@berry/zipfs';

import {Fetcher, FetchOptions, FetchResult} from './Fetcher';
import {WorkspaceResolver}                  from './WorkspaceResolver';
import * as structUtils                     from './structUtils';
import {Locator}                            from './types';

export class WorkspaceFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(WorkspaceResolver.protocol))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const sourcePath = this.getWorkspace(locator, opts).cwd;

    return {packageFs: new JailFS(sourcePath), prefixPath: `/`, localPath: sourcePath};
  }

  getWorkspace(locator: Locator, opts: FetchOptions) {
    const normalizedLocator = structUtils.makeLocator(locator, locator.reference.slice(WorkspaceResolver.protocol.length));

    return opts.project.getWorkspaceByLocator(normalizedLocator);
  }
}
