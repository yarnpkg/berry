import * as stageUtils from '../stageUtils';

export const Driver = {
  async findRoot(cwd: string) {
    return await stageUtils.findVcsRoot(cwd, {marker: `.hg`});
  },

  async filterChanges(cwd: string, paths: Set<string>, filenames: Set<string>) {
    return [];
  },

  async genCommitMessage(cwd: string, changeList: Array<stageUtils.FileAction>) {
    return ``;
  },

  async makeCommit(cwd: string, changeList: Array<stageUtils.FileAction>, commitMessage: string) {
  },

  async makeReset(cwd: string, changeList: Array<stageUtils.FileAction>) {
  },

  async makeUpdate(cwd: string, changeList: Array<stageUtils.FileAction>) {
  },
};
