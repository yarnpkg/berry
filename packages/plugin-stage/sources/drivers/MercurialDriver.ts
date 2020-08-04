import {PortablePath, Filename} from '@yarnpkg/fslib';

import * as stageUtils          from '../stageUtils';

export const Driver = {
  async findRoot(cwd: PortablePath) {
    return await stageUtils.findVcsRoot(cwd, {marker: `.hg` as Filename});
  },

  async filterChanges(cwd: string, paths: Set<string>, filenames: Set<string>) {
    return [];
  },

  async genCommitMessage(cwd: PortablePath, changeList: Array<stageUtils.FileAction>) {
    return ``;
  },

  async makeCommit(cwd: PortablePath, changeList: Array<stageUtils.FileAction>, commitMessage: string) {
  },

  async makeReset(cwd: PortablePath, changeList: Array<stageUtils.FileAction>) {
  },

  async makeUpdate(cwd: string, changeList: Array<stageUtils.FileAction>) {
  },
};
