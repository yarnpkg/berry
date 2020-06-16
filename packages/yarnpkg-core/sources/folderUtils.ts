import {PortablePath, npath, ppath} from '@yarnpkg/fslib';
import {homedir}                    from 'os';

export function getDefaultGlobalFolder() {
  if (process.platform === `win32`) {
    const base = npath.toPortablePath(process.env.LOCALAPPDATA || npath.join(homedir(), `AppData`, `Local`));
    return ppath.resolve(base, `Yarn/Berry` as PortablePath);
  }

  if (process.env.XDG_DATA_HOME) {
    const base = npath.toPortablePath(process.env.XDG_DATA_HOME);
    return ppath.resolve(base, `yarn/berry` as PortablePath);
  }

  return ppath.resolve(getHomeFolder(), `.yarn/berry` as PortablePath);
}

export function getHomeFolder() {
  return npath.toPortablePath(homedir() || `/usr/local/share`);
}

export function isFolderInside(target: PortablePath, parent: PortablePath) {
  const relative = ppath.relative(parent, target);

  return relative && !relative.startsWith(`..`) && !ppath.isAbsolute(relative);
}
