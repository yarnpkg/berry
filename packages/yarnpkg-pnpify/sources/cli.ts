#!/usr/bin/env node

import {Cli, Builtins} from 'clipanion';

import RunCommand      from './commands/RunCommand';
import SdkCommand      from './commands/SdkCommand';

const cli = new Cli({
  binaryLabel: `Yarn PnPify`,
  binaryName: `pnpify`,
  binaryVersion: require(`@yarnpkg/pnpify/package.json`).version,
});

cli.register(RunCommand);
cli.register(SdkCommand);

cli.register(Builtins.DefinitionsCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
