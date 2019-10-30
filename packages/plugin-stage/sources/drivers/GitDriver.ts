import {execUtils, Manifest, structUtils, IdentHash, Descriptor} from '@yarnpkg/core';
import {PortablePath, npath, ppath, toFilename}                  from '@yarnpkg/fslib';

import * as stageUtils                                           from '../stageUtils';

const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;

async function getLastCommitHash(cwd: PortablePath) {
  const {code, stdout} = await execUtils.execvp(`git`, [`log`, `-1`, `--pretty=format:%H`], {cwd});

  if (code === 0) {
    return stdout.trim();
  } else {
    return null;
  }
}

async function genCommitMessage(cwd: PortablePath, changes: Array<stageUtils.FileAction>) {
  const actions: Array<[stageUtils.ActionType, string]> = [];

  const modifiedPkgJsonFiles = changes.filter(change => {
    return ppath.basename(change.path) === `package.json`;
  });

  for (const {action, path} of modifiedPkgJsonFiles) {
    const relativePath = ppath.relative(cwd, path);

    if (action === stageUtils.ActionType.MODIFY) {
      const commitHash = await getLastCommitHash(cwd);
      const {stdout: prevSource} = await execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {cwd, strict: true});

      const prevManifest = await Manifest.fromText(prevSource);
      const currManifest = await Manifest.fromFile(path);

      const allCurrDeps: Map<IdentHash, Descriptor> = new Map([...currManifest.dependencies, ...currManifest.devDependencies]);
      const allPrevDeps: Map<IdentHash, Descriptor> = new Map([...prevManifest.dependencies, ...prevManifest.devDependencies]);

      for (const [indentHash, value] of allPrevDeps) {
        const pkgName = structUtils.stringifyIdent(value);
        const currDep = allCurrDeps.get(indentHash);

        if (!currDep) {
          actions.push([stageUtils.ActionType.REMOVE, pkgName]);
        } else if (currDep.range !== value.range) {
          actions.push([stageUtils.ActionType.MODIFY, `${pkgName} to ${currDep.range}`]);
        }
      }

      for (const [indentHash, value] of allCurrDeps) {
        if (!allPrevDeps.has(indentHash)) {
          actions.push([stageUtils.ActionType.ADD, structUtils.stringifyIdent(value)]);
        }
      }
    } else if (action === stageUtils.ActionType.CREATE) {
      // New package.json
      const manifest = await Manifest.fromFile(path);

      if (manifest.name) {
        actions.push([stageUtils.ActionType.CREATE, structUtils.stringifyIdent(manifest.name)]);
      } else {
        actions.push([stageUtils.ActionType.CREATE, `a package`]);
      }
    } else if (action === stageUtils.ActionType.DELETE) {
      const commitHash = await getLastCommitHash(cwd);
      const {stdout: prevSource} = await execUtils.execvp(`git`, [`show`, `${commitHash}:${relativePath}`], {cwd, strict: true});

      // Deleted package.json; we need to load it from its past sources
      const manifest = await Manifest.fromText(prevSource);

      if (manifest.name) {
        actions.push([stageUtils.ActionType.DELETE, structUtils.stringifyIdent(manifest.name)]);
      } else {
        actions.push([stageUtils.ActionType.DELETE, `a package`]);
      }
    } else {
      throw new Error(`Assertion failed: Unsupported action type`);
    }
  }

  const {code, stdout} = await execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {cwd});

  const lines = code === 0
    ? stdout.split(/\n/g).filter((line: string) => line !== ``)
    : [];

  const consensus = stageUtils.findConsensus(lines);
  const message = stageUtils.genCommitMessage(consensus, actions);

  return message;
}

export const Driver = {
  async findRoot(cwd: PortablePath) {
    return await stageUtils.findVcsRoot(cwd, {marker: toFilename(`.git`)});
  },

  async filterChanges(cwd: PortablePath, yarnRoots: Set<PortablePath>, yarnNames: Set<string>) {
    const {stdout} = await execUtils.execvp(`git`, [`status`, `-s`], {cwd, strict: true});
    const lines = stdout.toString().split(/\n/g);

    const changes = ([] as Array<stageUtils.FileAction>).concat(...lines.map((line: string) => {
      if (line === ``)
        return [];

      const prefix = line.slice(0, 3);
      const path = ppath.resolve(cwd, line.slice(3) as PortablePath);

      // New directories need to be expanded to their content
      if (prefix === `?? ` && line.endsWith(`/`)) {
        return stageUtils.expandDirectory(path).map(path => ({
          action: stageUtils.ActionType.CREATE,
          path,
        }));
      } else if (prefix === ` A ` || prefix === `?? `) {
        return [{
          action: stageUtils.ActionType.CREATE,
          path,
        }];
      } else if (prefix === ` M `) {
        return [{
          action: stageUtils.ActionType.MODIFY,
          path,
        }];
      } else if (prefix === ` D `) {
        return [{
          action: stageUtils.ActionType.DELETE,
          path,
        }];
      }
      else {
        return [];
      }
    }));

    return changes.filter(change => {
      return stageUtils.isYarnFile(change.path, {
        roots: yarnRoots,
        names: yarnNames,
      });
    });
  },

  async genCommitMessage(cwd: PortablePath, changeList: Array<stageUtils.FileAction>) {
    return await genCommitMessage(cwd, changeList);
  },

  async makeCommit(cwd: PortablePath, changeList: Array<stageUtils.FileAction>, commitMessage: string) {
    const localPaths = changeList.map(file => npath.fromPortablePath(file.path));

    await execUtils.execvp(`git`, [`add`, `-N`, `--`, ...localPaths], {cwd, strict: true});
    await execUtils.execvp(`git`, [`commit`, `-m`, `${commitMessage}\n\n${MESSAGE_MARKER}\n`, `--`, ...localPaths], {cwd, strict: true});
  },

  async makeReset(cwd: PortablePath, changeList: Array<stageUtils.FileAction>) {
    const localPaths = changeList.map(path => npath.fromPortablePath(path.path));

    await execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ...localPaths], {cwd, strict: true});
  },
};
