import {execUtils}     from '@berry/core';
import {NodeFS}        from '@berry/fslib';
import {posix}         from 'path';

import * as stageUtils from '../stageUtils';

const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;

async function genCommitMessage(cwd: string) {
  const {stdout} = await execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {cwd, strict: true});
  const lines = stdout.split(/\n/g).filter(line => line !== ``);

  return stageUtils.genCommitMessage(lines);
}

export const Driver = {
  async findRoot(cwd: string) {
    return await stageUtils.findVcsRoot(cwd, {marker: `.git`});
  },

  async filterChanges(cwd: string, yarnRoots: Set<string>, yarnNames: Set<string>) {
    const {stdout} = await execUtils.execvp(`git`, [`status`, `-s`], {cwd, strict: true});
    const lines = stdout.toString().split(/\n/g);
  
    const changes = ([] as Array<string>).concat(... lines.map(line => {
      if (line === ``)
        return [];
  
      const path = posix.resolve(cwd, line.slice(3));
  
      // New directories need to be expanded to their content
      if (line.startsWith(`?? `) && line.endsWith(`/`)) {
        return stageUtils.expandDirectory(path);
      } else {
        return [path];
      }
    }));
  
    return changes.filter(path => {
      return stageUtils.isYarnFile(path, {
        roots: yarnRoots,
        names: yarnNames,
      });
    });
  },

  setKeyValue(map: Map<string, number>, key: string) {
    if(map.has(key)) {
      const count = map.get(key);
      map.set(key, count ? count + 1 : 1);
    }
    else {
      map.set(key, 1);
    }
    return map;
  },

  async findChanges(cwd: string, changes: Array<string>) {

    const updates = new Map();
    const removes = new Map();
    const adds = new Map();
    for(const change of changes) {
      const {stdout:prevStdout} = await execUtils.execvp(`git`, [`show`, `HEAD~1:${change.substring(cwd.length+1)}`], {cwd, strict: true});
      const {stdout:currStdout} = await execUtils.execvp(`cat`, [`${change}`], {cwd, strict: true});
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
              this.setKeyValue(updates, key);
            }
          }
          else {
            const key = `Remove ${name}`;
            this.setKeyValue(removes, key);
          }
        }

        for(const currPkg of Object.entries(totalCurrDeps)) {
          const [name] = currPkg;
          if (!totalPrevDeps[name]) {
            const key = `Adds ${name}`;
            this.setKeyValue(adds, key);
          }
        }
      }
      catch(e) {
        console.log("Error", prevStdout, currStdout);
      }
    }
  },

  async makeCommit(cwd: string, changeList: Array<string>) {
    const localPaths = changeList.map(path => NodeFS.fromPortablePath(path));

    await execUtils.execvp(`git`, [`add`, `-N`, `--`, ... localPaths], {cwd, strict: true});
    await execUtils.execvp(`git`, [`commit`, `-m`, `${await genCommitMessage(cwd)}\n\n${MESSAGE_MARKER}\n`, `--`, ... localPaths], {cwd, strict: true});
  },

  async makeReset(cwd: string, changeList: Array<string>) {
    const localPaths = changeList.map(path => NodeFS.fromPortablePath(path));

    await execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ... localPaths], {cwd, strict: true});
  },
};
