import {NodeFS, PortablePath}                          from '@berry/fslib';
import {homedir}                         from 'os';
import {posix, win32}                    from 'path';

export function getDefaultGlobalFolder() {
  if (process.platform === `win32`) {
    const base = NodeFS.toPortablePath(process.env.LOCALAPPDATA || win32.join(homedir(), 'AppData', 'Local'));
    return posix.resolve(base, `Yarn/Berry`) as PortablePath;
  }

  if (process.env.XDG_DATA_HOME) {
    const base = NodeFS.toPortablePath(process.env.XDG_DATA_HOME);
    return posix.resolve(base, `yarn/berry`) as PortablePath;
  }

  return posix.resolve(getHomeFolder(), `.yarn/berry`) as PortablePath;
}

export function getHomeFolder() {
  return NodeFS.toPortablePath(homedir() || '/usr/local/share');
}
