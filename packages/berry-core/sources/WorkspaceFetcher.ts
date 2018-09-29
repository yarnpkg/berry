import {Fetcher, FetchOptions} from './Fetcher';
import {WorkspaceResolver}     from './WorkspaceResolver';
import * as structUtils        from './structUtils';
import {Locator}               from './types';

export class WorkspaceFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(WorkspaceResolver.protocol))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    locator = structUtils.makeLocatorFromIdent(locator, locator.reference.slice(WorkspaceResolver.protocol.length));

    const workspace = opts.project.getWorkspaceByLocator(locator);

    return workspace.cwd;
  }
}
