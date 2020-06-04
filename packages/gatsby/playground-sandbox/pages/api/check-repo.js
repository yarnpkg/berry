import {spawnSync} from 'child_process';
import fs          from 'fs';

import {BERRY_DIR} from '../../constants';

// eslint-disable-next-line arca/no-default-export
export default async (req, res) => {
  try {
    if (fs.existsSync(BERRY_DIR)) {
      const gitArgs = [
        `fetch`,
        `--dry-run`,
        `--verbose`,
      ];

      const {stderr} = spawnSync(`git`, gitArgs, {
        cwd: BERRY_DIR,
        encoding: `utf8`,
      });

      return res.status(200).json({
        status: `success`,
        fetchOutput: stderr,
        shouldClone: !stderr.includes(`up to date`),
      });
    } else {
      return res.status(200).json({
        status: `success`,
        shouldClone: true,
      });
    }
  } catch (error) {
    return res.status(500).json({
      status: `error`,
      error: error.toString(),
    });
  }
};
