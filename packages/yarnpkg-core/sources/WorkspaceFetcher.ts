import {CwdFS, PortablePath}   from '@yarnpkg/fslib';

import {Fetcher, FetchOptions} from './Fetcher';
import {WorkspaceResolver}     from './WorkspaceResolver';
import {Locator}               from './types';

export class WorkspaceFetcher implements Fetcher {
  supports(locator: Locator) {
    if (!locator.reference.startsWith(WorkspaceResolver.protocol))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    return this.getWorkspace(locator, opts).cwd;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const sourcePath = this.getWorkspace(locator, opts).cwd;

    return {packageFs: new CwdFS(sourcePath), prefixPath: PortablePath.dot, localPath: sourcePath};
  }

  getWorkspace(locator: Locator, opts: FetchOptions) {
    return opts.project.getWorkspaceByCwd(locator.reference.slice(WorkspaceResolver.protocol.length) as PortablePath);
  }
}
