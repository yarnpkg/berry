import * as stageUtils from '../stageUtils';

function findRoot(cwd: string) {
  return stageUtils.findVcsRoot(cwd, {marker: `.hg`});
}

function filterChanges(cwd: string, paths: Set<string>, filenames: Set<string>) {
  return [];
}

function makeCommit(cwd: string, changeList: Array<string>) {
}

function makeReset(cwd: string, changeList: Array<string>) {
}

function makeUpdate(cwd: string, changeList: Array<string>) {
}

export const Driver = {
  findRoot,
  filterChanges,
  makeCommit,
  makeReset,
};
