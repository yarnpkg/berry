import {executeRepro} from '@arcanis/sherlock/lib/executeRepro';
import path           from 'path';

import {BERRY_DIR}    from '../../constants';

// eslint-disable-next-line arca/no-default-export
export default async (req, res) => {
  try {
    const {code} = req.query;

    const executionResult = await executeRepro(code, [
      path.join(BERRY_DIR, `scripts/actions/sherlock-prepare.js`),
    ]);

    return res.status(200).json({
      status: `success`,
      executionResult,
    });
  } catch (error) {
    return res.status(500).json({
      status: `error`,
      error: error.toString(),
    });
  }
};
