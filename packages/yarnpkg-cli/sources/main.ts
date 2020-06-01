import {Configuration, CommandContext, PluginConfiguration} from '@yarnpkg/core';
import {PortablePath, npath, xfs}                           from '@yarnpkg/fslib';
import {execFileSync}                                       from 'child_process';
import {Cli}                                                from 'clipanion';
import {realpathSync}                                       from 'fs';

import {WelcomeCommand}                                     from './tools/WelcomeCommand';

function runBinary(path: PortablePath) {
  const physicalPath = npath.fromPortablePath(path);

  process.on(`SIGINT`, () => {
    // We don't want SIGINT to kill our process; we want it to kill the
    // innermost process, whose end will cause our own to exit.
  });

  if (physicalPath) {
    execFileSync(process.execPath, [physicalPath, ...process.argv.slice(2)], {
      stdio: `inherit`,
      env: {
        ...process.env,
        YARN_IGNORE_PATH: `1`,
        YARN_IGNORE_CWD: `1`,
      },
    });
  } else {
    execFileSync(physicalPath, process.argv.slice(2), {
      stdio: `inherit`,
      env: {
        ...process.env,
        YARN_IGNORE_PATH: `1`,
        YARN_IGNORE_CWD: `1`,
      },
    });
  }
}

export async function main({binaryVersion, pluginConfiguration}: {binaryVersion: string, pluginConfiguration: PluginConfiguration}) {
  async function run(): Promise<void> {
    const cli = new Cli<CommandContext>({
      binaryLabel: `Yarn Package Manager`,
      binaryName: `yarn`,
      binaryVersion,
    });

    cli.register(WelcomeCommand);

    try {
      await exec(cli);
    } catch (error) {
      process.stdout.write(cli.error(error));
      process.exitCode = 1;
    }
  }

  async function exec(cli: Cli<CommandContext>): Promise<void> {
    // Since we only care about a few very specific settings (yarn-path and ignore-path) we tolerate extra configuration key.
    // If we didn't, we wouldn't even be able to run `yarn config` (which is recommended in the invalid config error message)
    const configuration = await Configuration.find(npath.toPortablePath(process.cwd()), pluginConfiguration, {
      usePath: true,
      strict: false,
    });

    const yarnPath: PortablePath = configuration.get(`yarnPath`);
    const ignorePath = configuration.get(`ignorePath`);
    const ignoreCwd = configuration.get(`ignoreCwd`);

    if (yarnPath !== null && !ignorePath) {
      if (!xfs.existsSync(yarnPath)) {
        process.stdout.write(cli.error(new Error(`The "yarn-path" option has been set (in ${configuration.sources.get(`yarnPath`)}), but the specified location doesn't exist (${yarnPath}).`)));
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
          cli.register(command);

      const command = cli.process(process.argv.slice(2));

      // @ts-ignore: The cwd is a global option defined by BaseCommand
      const cwd: string | undefined = command.cwd;

      if (typeof cwd !== `undefined` && !ignoreCwd) {
        const iAmHere = realpathSync(process.cwd());
        const iShouldBeHere = realpathSync(cwd);

        if (iAmHere !== iShouldBeHere) {
          process.chdir(cwd);
          await run();
          return;
        }
      }

      cli.runExit(command, {
        cwd: npath.toPortablePath(process.cwd()),
        plugins: pluginConfiguration,
        quiet: false,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      });
    }
  }

  return run().catch(error => {
    process.stdout.write(error.stack || error.message);
    process.exitCode = 1;
  });
}
