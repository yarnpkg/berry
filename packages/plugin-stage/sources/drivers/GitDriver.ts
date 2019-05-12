import {execUtils}     from '@berry/core';
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
      const {stdout:prevStdout} = await execUtils.execvp(`git`, [`show`, `HEAD~1:${relativePath}`], {cwd, strict: true});
      const {stdout:currStdout} = await execUtils.execvp(`cat`, [`${localPath}`], {cwd, strict: true});
      try {
        const {dependencies: prevDeps, devDependencies: prevDevDeps} = JSON.parse(prevStdout.toString());
        const {dependencies: currDeps, devDependencies: currDevDeps} = JSON.parse(currStdout.toString());
        const totalPrevDeps = {...prevDeps, ...prevDevDeps};
        const totalCurrDeps = {...currDeps, ...currDevDeps};
        //Find all the  updates/adds/removes on the package.json compare to prev one
        for(const prevPkg of Object.entries(totalPrevDeps)) {
          const [name, version] = prevPkg;
          if(totalCurrDeps[name]) {
            if (version !== totalCurrDeps[name]) {
              const key = `Updates ${name} to ${totalCurrDeps[name]}`;
              setKeyValue(updates, key);
            }
          }
          else {
            const key = `Removes ${name}`;
            setKeyValue(removes, key);
          }
        }

        for(const currPkg of Object.entries(totalCurrDeps)) {
          const [name] = currPkg;
          if (!totalPrevDeps[name]) {
            const key = `Adds ${name}`;
            setKeyValue(adds, key);
          }
        }
      }
      catch(e) {
        console.log("Error GitDriver", prevStdout, currStdout);
      }
    }
    else if (action === stageUtils.ActionType.ADD) {
      //created package.json
      const {stdout:currStdout} = await execUtils.execvp(`cat`, [`${localPath}`], {cwd, strict: true});
      const {name: packageName} = JSON.parse(currStdout.toString());
      createdPackages.push(`Creates ${packageName}`);
    }
    else {
      //remove package.json
      const {stdout:prevStdout} = await execUtils.execvp(`git`, [`show`, `HEAD~1:${relativePath}`], {cwd, strict: true});
      const {name: packageName} = JSON.parse(prevStdout.toString());
      removedPackages.push(`Deletes ${packageName}`);
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
