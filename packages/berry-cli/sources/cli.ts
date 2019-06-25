import {Configuration}                                          from '@berry/core';
import {xfs, NodeFS, ppath, PortablePath}                       from '@berry/fslib';
import {execFileSync}                                           from 'child_process';
import {Clipanion}                                              from 'clipanion';
import * as yup                                                 from 'yup';

import {pluginConfiguration}                                    from './pluginConfiguration';

const clipanion = new Clipanion({configKey: null});

clipanion.topLevel(`[--cwd PATH]`)
  .validate(yup.object().shape({
    cwd: yup.string().transform((cwd = process.cwd()) => {
      // Note that the `--cwd` option might be a relative path that we need to resolve
      return ppath.resolve(NodeFS.toPortablePath(process.cwd()), NodeFS.toPortablePath(cwd));
    }),
  }));

function runBinary(path: PortablePath) {
  const physicalPath = NodeFS.fromPortablePath(path);

  if (physicalPath) {
    execFileSync(process.execPath, [physicalPath, ...process.argv.slice(2)], {
      stdio: `inherit`,
      env: {
        ...process.env,
        YARN_IGNORE_PATH: `1`,
      },
    });
  } else {
    execFileSync(physicalPath, process.argv.slice(2), {
      stdio: `inherit`,
      env: {
        ...process.env,
        YARN_IGNORE_PATH: `1`,
      },
    });
  }
}

async function run() {
  // Since we only care about a few very specific settings (yarn-path and ignore-path) we tolerate extra configuration key.
  // If we didn't, we wouldn't even be able to run `yarn config` (which is recommended in the invalid config error message)
  const configuration = await Configuration.find(NodeFS.toPortablePath(process.cwd()), pluginConfiguration, {
    strict: false,
  });

  const yarnPath: PortablePath = configuration.get(`yarnPath`);
  const ignorePath = configuration.get(`ignorePath`);

  if (yarnPath !== null && !ignorePath) {
    if (!xfs.existsSync(yarnPath)) {
      clipanion.error(new Error(`The "yarn-path" option has been set (in ${configuration.sources.get(`yarnPath`)}), but the specified location doesn't exist (${yarnPath}).`), {stream: process.stderr});
      process.exitCode = 1;
    } else {
      try {
        runBinary(yarnPath);
      } catch (error) {
        process.exitCode = error.code || 1;
      }
    }
  } else {
    if (ignorePath)
      delete process.env.YARN_IGNORE_PATH;

    for (const plugin of configuration.plugins.values())
      for (const command of plugin.commands || [])
        command(clipanion, pluginConfiguration);

    clipanion.runExit(`yarn`, process.argv.slice(2), {
      cwd: NodeFS.toPortablePath(process.cwd()),
    });
  }
}

run().catch(error => {
  clipanion.error(error, {stream: process.stdout});
  process.exitCode = 1;
});
