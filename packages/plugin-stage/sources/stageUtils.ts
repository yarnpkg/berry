import {xfs, Filename, PortablePath, ppath} from '@yarnpkg/fslib';

export enum ActionType {
  CREATE,
  DELETE,

  ADD,
  REMOVE,
  MODIFY,
}

export type FileAction = {
  action: ActionType,
  path: PortablePath,
};

export type Consensus = {
  useThirdPerson: boolean,
  useUpperCase: boolean,
  useComponent: boolean,
};

export async function findVcsRoot(cwd: PortablePath, {marker}: {marker: Filename}) {
  do {
    if (!xfs.existsSync(ppath.join(cwd, marker))) {
      cwd = ppath.dirname(cwd);
    } else {
      return cwd;
    }
  } while (cwd !== `/`);

  return null;
}

export function isYarnFile(path: PortablePath, {roots, names}: {roots: Set<string>, names: Set<string>}) {
  if (names.has(ppath.basename(path)))
    return true;

  do {
    if (!roots.has(path)) {
      path = ppath.dirname(path);
    } else {
      return true;
    }
  } while (path !== `/`);

  return false;
}

export function expandDirectory(initialCwd: PortablePath) {
  const paths = [];
  const cwds = [initialCwd];

  while (cwds.length > 0) {
    const cwd = cwds.pop();
    const listing = xfs.readdirSync(cwd!);

    for (const entry of listing) {
      const path = ppath.resolve(cwd!, entry);
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
    if (line === `wip`)
      continue;

    if (regex.test(line)) {
      yes += 1;
    } else {
      no += 1;
    }
  }

  return yes >= no;
}

export function findConsensus(lines: Array<string>): Consensus {
  const useThirdPerson = checkConsensus(lines, /^(\w\(\w+\):\s*)?\w+s/);
  const useUpperCase = checkConsensus(lines, /^(\w\(\w+\):\s*)?[A-Z]/);
  const useComponent = checkConsensus(lines, /^\w\(\w+\):/);

  return {
    useThirdPerson,
    useUpperCase,
    useComponent,
  };
}

export function getCommitPrefix(consensus: Consensus) {
  if (consensus.useComponent) {
    return `chore(yarn): `;
  } else {
    return ``;
  }
}

const VERBS = new Map([
  // Package actions
  [ActionType.CREATE, `create`],
  [ActionType.DELETE, `delete`],

  // File actions
  [ActionType.ADD, `add`],
  [ActionType.REMOVE, `remove`],
  [ActionType.MODIFY, `update`],
]);

export function genCommitMessage(consensus: Consensus, actions: Array<[ActionType, string]>) {
  const prefix = getCommitPrefix(consensus);
  const all = [];

  const sorted = actions.slice().sort((a, b) => {
    return a[0] - b[0];
  });

  while (sorted.length > 0) {
    const [type, what] = sorted.shift()!;

    let verb = VERBS.get(type)!;

    if (consensus.useUpperCase && all.length === 0)
      verb = `${verb[0].toUpperCase()}${verb.slice(1)}`;
    if (consensus.useThirdPerson)
      verb += `s`;

    const subjects = [what];

    while (sorted.length > 0 && sorted[0][0] === type) {
      const [, what] = sorted.shift()!;
      subjects.push(what);
    }

    subjects.sort();

    let description = subjects.shift()!;

    if (subjects.length === 1)
      description += ` (and one other)`;
    else if (subjects.length > 1)
      description += ` (and ${subjects.length} others)`;

    all.push(`${verb} ${description}`);
  }

  return `${prefix}${all.join(`, `)}`;
}

