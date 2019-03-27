import {xfs}   from '@berry/fslib';
import {posix} from 'path';

export async function findVcsRoot(cwd: string, {marker}: {marker: string}) {
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

export function checkConsensus(lines: Array<string>, regex: RegExp) {
  let yes = 0, no = 0;

  for (const line of lines) {
    if (regex.test(line)) {
      yes += 1;
    } else {
      no += 1;
    }
  }

  return yes >= no;
}

export function findConsensus(lines: Array<string>) {
  const useThirdPerson = checkConsensus(lines, /^(\w\(\w+\):\s*)?\w+s/);
  const useUpperCase = checkConsensus(lines, /^(\w\(\w+\):\s*)?[A-Z]/);
  const useComponent = checkConsensus(lines, /^\w\(\w+\):/);

  return {
    useThirdPerson,
    useUpperCase,
    useComponent,
  };
}

export function genCommitMessage(lines: Array<string>) {
  const {
    useThirdPerson,
    useUpperCase,
    useComponent,
  } = findConsensus(lines);

  const prefix = useComponent
    ? `chore(yarn): `
    : ``;

  const verb = useThirdPerson
    ? useUpperCase
      ? `Updates`
      : `updates`
    : useUpperCase
      ? `Update`
      : `update`;

  return `${prefix}${verb} the project settings`;
}
