import {Fetcher, FetchOptions} from './Fetcher';
import {WorkspaceBaseResolver} from './WorkspaceBaseResolver';
import * as structUtils        from './structUtils';
import {Locator}               from './types';

export class WorkspaceBaseFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(WorkspaceBaseResolver.protocol))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    locator = structUtils.makeLocatorFromIdent(locator, locator.reference.slice(WorkspaceBaseResolver.protocol.length));

    const workspace = opts.project.getWorkspaceByLocator(locator);

    return workspace.cwd;
  }
}
