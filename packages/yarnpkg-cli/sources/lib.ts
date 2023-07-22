import {Configuration, CommandContext, PluginConfiguration, TelemetryManager, semverUtils, miscUtils, YarnVersion} from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs}                                                                           from '@yarnpkg/fslib';
import {execFileSync}                                                                                              from 'child_process';
import {isCI}                                                                                                      from 'ci-info';
import {Cli, UsageError}                                                                                           from 'clipanion';

import {pluginCommands}                                                                                            from './pluginCommands';

function getBaseCli() {
  return new Cli<CommandContext>({
    binaryLabel: `Yarn Package Manager`,
    binaryName: `yarn`,
    binaryVersion: YarnVersion ?? `<unknown>`,
  });
}

function validateNodejsVersion(cli: Cli<CommandContext>) {
  // YARN_IGNORE_NODE is special because this code needs to execute as early as possible.
  // It's not a regular core setting because Configuration.find may use functions not available
  // on older Node versions.
  const ignoreNode = miscUtils.parseOptionalBoolean(process.env.YARN_IGNORE_NODE);
  if (ignoreNode)
    return true;

  const version = process.versions.node;

  // Non-exhaustive known requirements:
  // - 18.12 is the first LTS release
  const range = `>=18.12.0`;

  if (semverUtils.satisfiesWithPrereleases(version, range))
    return true;

  const error = new UsageError(`This tool requires a Node version compatible with ${range} (got ${version}). Upgrade Node, or set \`YARN_IGNORE_NODE=1\` in your environment.`);
  Cli.defaultContext.stdout.write(cli.error(error));

  return false;
}

async function getCoreConfiguration({pluginConfiguration}: {pluginConfiguration: PluginConfiguration}) {
  // Since we only care about a few very specific settings we tolerate extra configuration key.
  // If we didn't, we wouldn't even be able to run `yarn config` (which is recommended in the invalid config error message)
  return await Configuration.find(npath.toPortablePath(process.cwd()), pluginConfiguration, {
    usePath: true,
    strict: false,
  });
}

async function checkYarnPath({configuration}: {configuration: Configuration}): Promise<PortablePath | null> {
  const yarnPath = configuration.get(`yarnPath`);
  const ignorePath = configuration.get(`ignorePath`);
  const ignoreCwd = configuration.get(`ignoreCwd`);

  const selfPath = npath.toPortablePath(npath.resolve(process.argv[1]));

  const tryRead = (p: PortablePath) => xfs.readFilePromise(p).catch(() => {
    return Buffer.of();
  });

  const isSameBinary = async () =>
    yarnPath && (
      yarnPath === selfPath ||
        Buffer.compare(...await Promise.all([
          tryRead(yarnPath),
          tryRead(selfPath),
        ])) === 0
    );

  if (!ignorePath && !ignoreCwd && await isSameBinary()) {
    return null;
  } else if (yarnPath !== null && !ignorePath) {
    return yarnPath;
  } else {
    return null;
  }
}

function runYarnPath(cli: Cli<CommandContext>, argv: Array<string>, {yarnPath}: {yarnPath: PortablePath}) {
  if (!xfs.existsSync(yarnPath)) {
    (cli.error(new Error(`The "yarn-path" option has been set, but the specified location doesn't exist (${yarnPath}).`)));
    return 1;
  }

  process.on(`SIGINT`, () => {
    // We don't want SIGINT to kill our process; we want it to kill the
    // innermost process, whose end will cause our own to exit.
  });

  const yarnPathExecOptions = {
    stdio: `inherit`,
    env: {
      ...process.env,
      YARN_IGNORE_PATH: `1`,
    },
  } as const;

  try {
    execFileSync(process.execPath, [npath.fromPortablePath(yarnPath), ...argv], yarnPathExecOptions);
  } catch (err) {
    return (err.code as number) ?? 1;
  }

  return 0;
}

function checkCwd(argv: Array<string>): [PortablePath, Array<string>] {
  const forcedCwd = process.env.YARN_IGNORE_CWD === `1`
    ? ppath.cwd()
    : null;

  if (argv[0] === `--cwd`)
    return [forcedCwd ?? xfs.realpathSync(npath.toPortablePath(argv[1])), argv.slice(2)];

  if (argv[0].startsWith(`--cwd=`))
    return [forcedCwd ?? xfs.realpathSync(npath.toPortablePath(argv[0].slice(6))), argv.slice(1)];

  return [ppath.cwd(), argv];
}

function initTelemetry(cli: Cli<CommandContext>, {configuration}: {configuration: Configuration}) {
  const isTelemetryEnabled = configuration.get(`enableTelemetry`);
  if (!isTelemetryEnabled || isCI || !process.stdout.isTTY)
    return;

  Configuration.telemetry = new TelemetryManager(configuration, `puba9cdc10ec5790a2cf4969dd413a47270`);

  for (const name of configuration.plugins.keys())
    if (pluginCommands.has(name.match(/^@yarnpkg\/plugin-(.*)$/)?.[1] ?? ``))
      Configuration.telemetry?.reportPluginName(name);

  if (cli.binaryVersion) {
    Configuration.telemetry.reportVersion(cli.binaryVersion);
  }
}

function initCommands(cli: Cli<CommandContext>, {configuration}: {configuration: Configuration}) {
  for (const plugin of configuration.plugins.values()) {
    for (const command of plugin.commands || []) {
      cli.register(command);
    }
  }
}

function processArgv(cli: Cli<CommandContext>, argv: Array<string>, {cwd, pluginConfiguration}: {cwd: PortablePath, pluginConfiguration: PluginConfiguration}) {
  const context = {
    cwd,
    plugins: pluginConfiguration,
    quiet: false,
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
  };

  return {
    context,
    command: cli.process(argv, context),
  };
}

async function mainNoExit(cli: Cli<CommandContext>, argv: Array<string>, {pluginConfiguration}: {pluginConfiguration: PluginConfiguration}) {
  if (!validateNodejsVersion(cli))
    return 1;

  const configuration = await getCoreConfiguration({pluginConfiguration});

  const yarnPath = await checkYarnPath({configuration});
  if (yarnPath !== null)
    return runYarnPath(cli, argv, {yarnPath});

  const [cwd, postCwdArgv] = checkCwd(argv);

  initTelemetry(cli, {configuration});
  initCommands(cli, {configuration});

  const {command, context} = processArgv(cli, postCwdArgv, {cwd, pluginConfiguration});
  if (!command.help)
    Configuration.telemetry?.reportCommandName(command.path.join(` `));

  return await cli.run(command, context);
}

export async function getCli({pluginConfiguration}: {pluginConfiguration: PluginConfiguration}) {
  const cli = getBaseCli();
  const configuration = await getCoreConfiguration({pluginConfiguration});

  initCommands(cli, {configuration});
}

export async function runExit(argv: Array<string>, {pluginConfiguration}: {pluginConfiguration: PluginConfiguration}) {
  const cli = getBaseCli();

  try {
    process.exitCode = await mainNoExit(cli, argv, {pluginConfiguration});
  } catch (error) {
    Cli.defaultContext.stdout.write(cli.error(error));
    process.exitCode = 1;
  } finally {
    await xfs.rmtempPromise();
  }
}
