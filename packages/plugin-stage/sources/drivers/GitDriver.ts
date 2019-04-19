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
