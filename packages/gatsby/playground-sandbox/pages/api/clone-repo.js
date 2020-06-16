import {spawnSync}                           from 'child_process';
import rimraf                                from 'rimraf';

import {PLAYGROUND_DIR, BERRY_DIR, REPO_URL} from '../../constants';

// eslint-disable-next-line arca/no-default-export
export default async (req, res) => {
  try {
    rimraf.sync(BERRY_DIR);

    const gitArgs = [
      `clone`,
      REPO_URL,
      `--depth`, `1`,
      `--progress`,
    ];

    const {stderr} = spawnSync(`git`, gitArgs, {
      cwd: PLAYGROUND_DIR,
      encoding: `utf8`,
    });

    return res.status(200).json({
      status: `success`,
      cloneOutput: stderr,
    });
  } catch (error) {
    return res.status(500).json({
      status: `error`,
      error: error.toString(),
    });
  }
};
