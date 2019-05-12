import * as stageUtils from '../stageUtils';
import { PortablePath } from '@berry/fslib';

export const Driver = {
  async findRoot(cwd: PortablePath) {
    return await stageUtils.findVcsRoot(cwd, {marker: `.hg`});
  },

  async filterChanges(cwd: string, paths: Set<string>, filenames: Set<string>) {
    return [];
  },

  async makeCommit(cwd: string, changeList: Array<string>) {
  },

  async makeReset(cwd: string, changeList: Array<string>) {
  },

  async makeUpdate(cwd: string, changeList: Array<string>) {
  },
};
