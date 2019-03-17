import {xfs}           from '@berry/fslib';
import {execFileSync}  from 'child_process';
import {posix}         from 'path';

import * as stageUtils from '../stageUtils';

const MESSAGE_MARKER = `Commit generated via \`yarn stage\``;
const COMMIT_DEPTH = 11;

function findRoot(cwd: string) {
  return stageUtils.findVcsRoot(cwd, {marker: `.git`});
}

function filterChanges(cwd: string, yarnRoots: Set<string>, yarnNames: Set<string>) {
  const changelist = [];

  const buffer = execFileSync(`git`, [`status`, `-s`], {cwd});
  const lines = buffer.toString().split(/\n/g);

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
}

function makeCommit(cwd: string, changeList: Array<string>) {
  execFileSync(`git`, [`add`, `-N`, `--`, ... changeList], {cwd});
  execFileSync(`git`, [`commit`, `-m`, `${genCommitMessage(cwd)}\n\n${MESSAGE_MARKER}\n`, `--`, ... changeList], {cwd});
}

function makeReset(cwd: string, changeList: Array<string>) {
  execFileSync(`git`, [`reset`, `HEAD`, `--`, ... changeList], {cwd});
}

function genCommitMessage(cwd: string) {
  const buffer = execFileSync(`git`, [`log`, `-${COMMIT_DEPTH}`, `--pretty=format:%s`], {cwd});
  const lines = buffer.toString().split(/\n/g).filter(line => line !== ``);

  const useThirdPerson = checkConsensus(lines, /^(\w\(\w+\):\s*)?\w+s/);
  const useUpperCase = checkConsensus(lines, /^(\w\(\w+\):\s*)?[A-Z]/);
  const useComponent = checkConsensus(lines, /^\w\(\w+\):/);

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

function checkConsensus(lines: Array<string>, regex: RegExp) {
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

export const Driver = {
  findRoot,
  filterChanges,
  makeCommit,
  makeReset,
};
