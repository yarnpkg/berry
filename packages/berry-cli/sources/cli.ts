import {Configuration}         from '@berry/core';
import {xfs}                   from '@berry/fslib';
import {UsageError, Concierge} from '@manaflair/concierge';
import {execFileSync}          from 'child_process';
import Joi                     from 'joi';

import {pluginConfiguration}   from './pluginConfiguration';

const concierge = new Concierge({Joi, configKey: null});

concierge.topLevel(`[--cwd PATH]`).validate(Joi.object().unknown().keys({
  cwd: Joi.string().default(process.cwd()),
}));

function runBinary(path: string) {
  if (path.endsWith(`.js`)) {
    execFileSync(process.execPath, [path, ...process.argv.slice(2)], {
      stdio: `inherit`,
      env: {
        ... process.env,
        YARN_IGNORE_PATH: `1`,
      }
    });
  } else {
    execFileSync(path, process.argv.slice(2), {
      stdio: `inherit`,
      env: {
        ... process.env,
        YARN_IGNORE_PATH: `1`,
      }
    });
  }
}

async function run() {
  const configuration = await Configuration.find(process.cwd(), pluginConfiguration);

  const yarnPath = configuration.get(`yarnPath`);
  const ignorePath = configuration.get(`ignorePath`);

  if (yarnPath !== null && !ignorePath) {
    if (!xfs.existsSync(yarnPath)) {
      concierge.error(new UsageError(`The "yarn-path" option has been set (in ${configuration.sources.get(`yarnPath`)}), but the specified location doesn't exist (${yarnPath}).`), {stream: process.stderr});
      process.exitCode = 1;
    } else {
      try {
        runBinary(yarnPath);
      } catch (error) {
        process.exitCode = error.code || 1;
      }
    }
  } else {
    for (const plugin of configuration.plugins.values())
      for (const command of plugin.commands || [])
        command(concierge, pluginConfiguration);

    concierge.runExit(`yarn`, process.argv.slice(2));
  }
}

run().catch(error => {
  concierge.error(error, {stream: process.stdout});
  process.exitCode = 1;
});
