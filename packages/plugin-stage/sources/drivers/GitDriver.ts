import {execUtils}     from '@berry/core';
import {NodeFS, PortablePath, ppath, toFilename}        from '@berry/fslib';

import * as stageUtils from '../stageUtils';

const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;

async function genCommitMessage(cwd: PortablePath) {
  const {stdout} = await execUtils.execvp(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {cwd, strict: true});
  const lines = stdout.split(/\n/g).filter(line => line !== ``);

  return stageUtils.genCommitMessage(lines);
}

export const Driver = {
  async findRoot(cwd: PortablePath) {
    return await stageUtils.findVcsRoot(cwd, {marker: toFilename(`.git`)});
  },

  async filterChanges(cwd: PortablePath, yarnRoots: Set<PortablePath>, yarnNames: Set<string>) {
    const {stdout} = await execUtils.execvp(`git`, [`status`, `-s`], {cwd, strict: true});
    const lines = stdout.toString().split(/\n/g);

    const changes = ([] as Array<PortablePath>).concat(... lines.map(line => {
      if (line === ``)
        return [];

      const path = ppath.resolve(cwd, line.slice(3) as PortablePath);

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

  async makeCommit(cwd: PortablePath, changeList: Array<PortablePath>) {
    const localPaths = changeList.map(path => NodeFS.fromPortablePath(path));

    await execUtils.execvp(`git`, [`add`, `-N`, `--`, ... localPaths], {cwd, strict: true});
    await execUtils.execvp(`git`, [`commit`, `-m`, `${await genCommitMessage(cwd)}\n\n${MESSAGE_MARKER}\n`, `--`, ... localPaths], {cwd, strict: true});
  },

  async makeReset(cwd: PortablePath, changeList: Array<PortablePath>) {
    const localPaths = changeList.map(path => NodeFS.fromPortablePath(path));

    await execUtils.execvp(`git`, [`reset`, `HEAD`, `--`, ... localPaths], {cwd, strict: true});
  },
};
