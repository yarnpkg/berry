import {execUtils, Manifest, structUtils, IdentHash, Descriptor}     from '@berry/core';
import {NodeFS}        from '@berry/fslib';
import {posix}         from 'path';

import * as stageUtils from '../stageUtils';

const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;


async function genCommitMessage(cwd: string, changes: Array<stageUtils.FileAction>) {
  const updates = new Map();
  const removes = new Map();
  const adds = new Map();
  const createdPackages = [];
  const removedPackages = [];

  for(const change of changes) {
    const { action, path } = change;
    const localPath = NodeFS.fromPortablePath(path);
    const relativePath = posix.relative(cwd, localPath);
    if (action === stageUtils.ActionType.MODIFY) {
      const prevManifest = await Manifest.fromText(`git`, [`show`, `HEAD~1:${relativePath}`], {cwd, strict: true});
      const currManifest = await Manifest.fromFile(localPath);
      const allCurrDeps: Map<IdentHash, Descriptor> = new Map([...currManifest.dependencies, ...currManifest.devDependencies]);
      const allPrevDeps: Map<IdentHash, Descriptor> = new Map([...prevManifest.dependencies, ...prevManifest.devDependencies]);

      for(const [indentHash, value] of allPrevDeps) {
        const pkgName = structUtils.stringifyIdent(value);
        const currDep = allCurrDeps.get(indentHash);
        if (currDep) {
          if(currDep.range !== value.range) {
            const key = `Updates ${pkgName} to ${value.range}`;
            setKeyValue(updates, key);
          }
        }
        else {
          const key = `Removes ${pkgName}`;
          setKeyValue(removes, key);
        }
      }

      for(const [indentHash, value] of allCurrDeps) {
        if (!allPrevDeps.has(indentHash)) {
          const pkgName = structUtils.stringifyIdent(value);
          const key = `Adds ${pkgName}`;
          setKeyValue(adds, key);
        }
      }
    }
    else if (action === stageUtils.ActionType.ADD) {
      //created package.json
      const manifest = await Manifest.fromFile(localPath)
      if (manifest.name){
        const packageName = structUtils.stringifyIdent(manifest.name);
        createdPackages.push(`Creates ${packageName}`);
      }
    }
    else {
      //remove package.json
      const manifest = await Manifest.fromText(`git`, [`show`, `HEAD~1:${relativePath}`], {cwd, strict: true});
      if (manifest.name){
        const packageName = structUtils.stringifyIdent(manifest.name);
        removedPackages.push(`Deletes ${packageName}`);
      }
    }
  }

  if(adds.size || removes.size || updates.size || createdPackages.length || removedPackages) {
    const commitMessages: string[] = [
      ...genPackagesCommitMessage(adds),
      ...genPackagesCommitMessage(removes),
      ...genPackagesCommitMessage(updates),
      ...createdPackages,
      ...removedPackages
    ];

    return commitMessages.join(", ");
  }

  const {stdout} = await execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {cwd, strict: true});
  const lines = stdout.split(/\n/g).filter((line: string) => line !== ``);

  return stageUtils.genCommitMessage(lines);
}

function setKeyValue(map: Map<string, number>, key: string) {
  if(map.has(key)) {
    const count = map.get(key);
    map.set(key, count ? count + 1 : 1);
  }
  else {
    map.set(key, 1);
  }
  return map;
}

function genPackagesCommitMessage(actions:Map<string, number>): Array<string> {
  const messages = [];
  for(const action of actions) {
    if (action[1] === 1) {
      messages.push(`${action[0]}`);
    }
    else {
      messages.push(`${action[0]} (+${action[1]})`);
    }
  }
  return messages;
}

export const Driver = {
  async findRoot(cwd: string) {
    return await stageUtils.findVcsRoot(cwd, {marker: `.git`});
  },

  async filterChanges(cwd: string, yarnRoots: Set<string>, yarnNames: Set<string>) {
    const {stdout} = await execUtils.execvp(`git`, [`status`, `-s`], {cwd, strict: true});
    const lines = stdout.toString().split(/\n/g);

    const changes = ([] as Array<stageUtils.FileAction>).concat(... lines.map((line: string) => {
      if (line === ``)
        return [];

      const path = posix.resolve(cwd, line.slice(3));
      // New directories need to be expanded to their content
      if (line.startsWith(`?? `) && line.endsWith(`/`)) {
        return stageUtils.expandDirectory(path).map(path => ({
          action: stageUtils.ActionType.ADD,
          path
        }));
      } else if (line.startsWith(` A `)) {
        return [{
          action: stageUtils.ActionType.ADD,
          path
        }];
      } else if (line.startsWith(` M `)) {
        return [{
          action: stageUtils.ActionType.MODIFY,
          path
        }];
      } else if (line.startsWith(` D `)) {
        return [{
          action: stageUtils.ActionType.REMOVE,
          path
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

  async makeCommit(cwd: string, changeList: Array<stageUtils.FileAction>) {
    const localPaths = changeList.map(file => NodeFS.fromPortablePath(file.path));
    await execUtils.execvp(`git`, [`add`, `-N`, `--`, ... localPaths], {cwd, strict: true});
    await execUtils.execvp(`git`, [`commit`, `-m`, `${await genCommitMessage(cwd, changeList)}\n\n${MESSAGE_MARKER}\n`, `--`, ... localPaths], {cwd, strict: true});
  },

  async makeReset(cwd: string, changeList: Array<stageUtils.FileAction>) {
    const localPaths = changeList.map(path => NodeFS.fromPortablePath(path.path));

    await execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ... localPaths], {cwd, strict: true});
  },
};
