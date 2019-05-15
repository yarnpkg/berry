import {NodeFS, PortablePath, ppath, npath} from '@berry/fslib';
import {homedir}                            from 'os';

export function getDefaultGlobalFolder() {
  if (process.platform === `win32`) {
    const base = NodeFS.toPortablePath(process.env.LOCALAPPDATA || npath.join(homedir(), 'AppData', 'Local'));
    return ppath.resolve(base, `Yarn/Berry` as PortablePath);
  }

  if (process.env.XDG_DATA_HOME) {
    const base = NodeFS.toPortablePath(process.env.XDG_DATA_HOME);
    return ppath.resolve(base, `yarn/berry` as PortablePath);
  }

  return ppath.resolve(getHomeFolder(), `.yarn/berry` as PortablePath);
}

export function getHomeFolder() {
  return NodeFS.toPortablePath(homedir() || '/usr/local/share');
}
