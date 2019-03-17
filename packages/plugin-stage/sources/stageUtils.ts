import {xfs}   from '@berry/fslib';
import {posix} from 'path';

export function findVcsRoot(cwd: string, {marker}: {marker: string}) {
  do {
    if (!xfs.existsSync(`${cwd}/${marker}`)) {
      cwd = posix.dirname(cwd);
    } else {
      return cwd;
    }
  } while (cwd !== `/`);

  return null;
}

export function isYarnFile(path: string, {roots, names}: {roots: Set<string>, names: Set<string>}) {
  if (names.has(posix.basename(path)))
    return true;

  do {
    if (!roots.has(path)) {
      path = posix.dirname(path);
    } else {
      return true;
    }
  } while (path !== `/`);

  return false;
}

export function expandDirectory(initialCwd: string) {
  const paths = [];
  const cwds = [initialCwd];

  while (cwds.length > 0) {
    const cwd = cwds.pop() as string;
    const listing = xfs.readdirSync(cwd);

    for (const entry of listing) {
      const path = posix.resolve(cwd, entry);
      const stat = xfs.lstatSync(path);

      if (stat.isDirectory()) {
        cwds.push(path);
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}
