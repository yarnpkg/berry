import {Configuration, CommandContext, PluginConfiguration, TelemetryManager, semverUtils} from '@yarnpkg/core';
import {PortablePath, npath, xfs}                                                          from '@yarnpkg/fslib';
import {execFileSync}                                                                      from 'child_process';
import {Cli, UsageError}                                                                   from 'clipanion';

import {realpathSync}                                                                      from 'fs';

import {pluginCommands}                                                                    from './pluginCommands';
import {WelcomeCommand}                                                                    from './tools/WelcomeCommand';

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
    // Non-exhaustive known requirements:
    // - 10.16+ for Brotli support on `plugin-compat`
    // - 10.17+ to silence `got` warning on `dns.promises`

    const version = process.versions.node;
    const range = `>=10.17`;

    if (!semverUtils.satisfiesWithPrereleases(version, range) && process.env.YARN_IGNORE_NODE !== `1`)
      throw new UsageError(`This tool requires a Node version compatible with ${range} (got ${version}). Upgrade Node, or set \`YARN_IGNORE_NODE=1\` in your environment.`);

    // Since we only care about a few very specific settings (yarn-path and ignore-path) we tolerate extra configuration key.
    // If we didn't, we wouldn't even be able to run `yarn config` (which is recommended in the invalid config error message)
    const configuration = await Configuration.find(npath.toPortablePath(process.cwd()), pluginConfiguration, {
      usePath: true,
      strict: false,
    });

    const yarnPath: PortablePath = configuration.get(`yarnPath`);
    const ignorePath = configuration.get(`ignorePath`);
    const ignoreCwd = configuration.get(`ignoreCwd`);

    // Avoid unnecessary spawn when run directly
    if (!ignorePath && !ignoreCwd && yarnPath === npath.toPortablePath(npath.resolve(process.argv[1]))) {
      process.env.YARN_IGNORE_PATH = `1`;
      process.env.YARN_IGNORE_CWD = `1`;

      await exec(cli);
      return;
    } else if (yarnPath !== null && !ignorePath) {
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

      const isTelemetryEnabled = configuration.get<boolean>(`enableTelemetry`);
      if (isTelemetryEnabled)
        Configuration.telemetry = new TelemetryManager(configuration, `puba9cdc10ec5790a2cf4969dd413a47270`);

      Configuration.telemetry?.reportVersion(binaryVersion);

      for (const [name, plugin] of configuration.plugins.entries()) {
        if (pluginCommands.has(name.match(/^@yarnpkg\/plugin-(.*)$/)?.[1] ?? ``))
          Configuration.telemetry?.reportPluginName(name);

        for (const command of plugin.commands || []) {
          cli.register(command);
        }
      }

      const command = cli.process(process.argv.slice(2));
      if (!command.help)
        Configuration.telemetry?.reportCommandName(command.path.join(` `));

      // @ts-expect-error: The cwd is a global option defined by BaseCommand
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

      await cli.runExit(command, {
        cwd: npath.toPortablePath(process.cwd()),
        plugins: pluginConfiguration,
        quiet: false,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      });
    }
  }

  return run()
    .catch(error => {
      process.stdout.write(error.stack || error.message);
      process.exitCode = 1;
    })
    .finally(() => xfs.rmtempPromise());
}
