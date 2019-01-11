import {Configuration} from '@berry/core';
// @ts-ignore
import {concierge}     from '@manaflair/concierge';
import {execFileSync}  from 'child_process';
import Joi             from 'joi';

import {plugins}       from './plugins';

Error.stackTraceLimit = Infinity;

process.removeAllListeners("unhandledRejection");
process.on('unhandledRejection', err => {
  console.error(`unhandled`, err.stack);
  process.exit(1);
});

function parseBoolean(value: string | undefined) {
  if (value === undefined) {
    return false;
  } else {
    switch (value) {
      case ``:
      case `no`:
      case `false`:
      case `0`:
        return false;

      case `yes`:
      case `true`:
      case `1`:
        return true;

      default: {
        throw new Error(`Invalid value`);
      }
    }
  }
}

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

  if (configuration.executablePath !== null && !configuration.ignorePath) {
    runBinary(configuration.executablePath);
  } else {
    // @ts-ignore: IS_WEBPACK is valid with Webpack
    if (typeof IS_WEBPACK !== `undefined`) {
      // @ts-ignore: require.context is valid with Webpack
      concierge.directory(require.context(`./commands`, true, /\.ts$/));
    } else {
      concierge.directory(`${__dirname}/commands`, true, /\.ts$/);
    }

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
