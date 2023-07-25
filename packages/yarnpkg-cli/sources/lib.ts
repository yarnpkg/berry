import {Configuration, CommandContext, PluginConfiguration, TelemetryManager, semverUtils, miscUtils, YarnVersion} from '@yarnpkg/core';
import {PortablePath, npath, ppath, xfs}                                                                           from '@yarnpkg/fslib';
import {isCI}                                                                                                      from 'ci-info';
import {Cli, UsageError}                                                                                           from 'clipanion';
import Module                                                                                                      from 'module';

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

async function getCoreConfiguration({selfPath, pluginConfiguration}: {selfPath: PortablePath | null, pluginConfiguration: PluginConfiguration}) {
  // Since we only care about a few very specific settings we tolerate extra configuration key.
  // If we didn't, we wouldn't even be able to run `yarn config` (which is recommended in the invalid config error message)
  return await Configuration.find(npath.toPortablePath(process.cwd()), pluginConfiguration, {
    strict: false,
    usePathCheck: selfPath,
  });
}

// We load the binary into the current process,
// while making it think it was spawned.
function runYarnPath(cli: Cli<CommandContext>, argv: Array<string>, {yarnPath}: {yarnPath: PortablePath}) {
  if (!xfs.existsSync(yarnPath)) {
    (cli.error(new Error(`The "yarn-path" option has been set, but the specified location doesn't exist (${yarnPath}).`)));
    return 1;
  }

  const binPath = npath.fromPortablePath(yarnPath);

  process.env.YARN_IGNORE_PATH = `1`;

  process.argv = [
    process.execPath,
    binPath,
    ...argv,
  ];
  process.execArgv = [];

  // Unset the mainModule and let Node.js set it when needed.
  process.mainModule = undefined;

  // Use nextTick to unwind the stack, and consequently remove this binary from
  // the stack trace of the next binary.
  process.nextTick(Module.runMain, binPath);

  return 0;
}

function checkCwd(argv: Array<string>): [PortablePath, Array<string>] {
  if (argv.length >= 2 && argv[0] === `--cwd`)
    return [xfs.realpathSync(npath.toPortablePath(argv[1])), argv.slice(2)];

  if (argv.length >= 1 && argv[0].startsWith(`--cwd=`))
    return [xfs.realpathSync(npath.toPortablePath(argv[0].slice(6))), argv.slice(1)];

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

async function run(cli: Cli<CommandContext>, argv: Array<string>, {selfPath, pluginConfiguration}: {selfPath: PortablePath | null, pluginConfiguration: PluginConfiguration}) {
  if (!validateNodejsVersion(cli))
    return 1;

  const configuration = await getCoreConfiguration({
    selfPath,
    pluginConfiguration,
  });

  const yarnPath = configuration.get(`yarnPath`);
  const ignorePath = configuration.get(`ignorePath`);

  if (yarnPath && !ignorePath)
    return runYarnPath(cli, argv, {yarnPath});

  delete process.env.YARN_IGNORE_PATH;

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

  const configuration = await getCoreConfiguration({
    pluginConfiguration,
    selfPath: null,
  });

  initCommands(cli, {configuration});

  return cli;
}

export async function runExit(argv: Array<string>, {selfPath, pluginConfiguration}: {selfPath: PortablePath | null, pluginConfiguration: PluginConfiguration}) {
  const cli = getBaseCli();

  try {
    process.exitCode = await run(cli, argv, {selfPath, pluginConfiguration});
  } catch (error) {
    Cli.defaultContext.stdout.write(cli.error(error));
    process.exitCode = 1;
  } finally {
    await xfs.rmtempPromise();
  }
}
