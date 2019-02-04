import {Configuration}         from '@berry/core';
import {xfs}                   from '@berry/fslib';
// @ts-ignore
import {UsageError, concierge} from '@manaflair/concierge';
import {execFileSync}          from 'child_process';
import Joi                     from 'joi';

import {plugins}               from './plugins';

Error.stackTraceLimit = Infinity;

process.removeAllListeners(`unhandledRejection`);
process.on(`unhandledRejection`, err => {
  console.error(`unhandled`, err.stack);
  process.exit(1);
});

function runBinary(path: string) {
  if (path.endsWith(`.js`)) {
    execFileSync(process.execPath, [path, ...process.argv.slice(2)], {
      stdio: `inherit`,
      env: {
        ... process.env,
        BERRY_IGNORE_PATH: `1`,
      }
    });
  } else {
    execFileSync(path, process.argv.slice(2), {
      stdio: `inherit`,
      env: {
        ... process.env,
        BERRY_IGNORE_PATH: `1`,
      }
    });
  }
}

async function run() {
  const configuration = await Configuration.find(process.cwd(), plugins);

  const executablePath = configuration.get(`executablePath`);
  const ignorePath = configuration.get(`ignorePath`);

  if (executablePath !== null && !ignorePath) {
    if (!xfs.existsSync(executablePath)) {
      concierge.error(new UsageError(`The "executable-path" option has been set (in ${configuration.sources.get(`executablePath`)}), but the specified location doesn't exists (${executablePath}).`), {stream: process.stderr});
      process.exitCode = 1;
    } else {
      runBinary(executablePath);
    }
  } else {
    concierge.topLevel(`[--cwd PATH]`).validate(Joi.object().unknown().keys({
      cwd: Joi.string().default(process.cwd()),
    }));

    for (const plugin of plugins.values())
      for (const command of plugin.commands || [])
        command(concierge, plugins);

    concierge.runExit(process.argv0, process.argv.slice(2));
  }
}

run().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
