#!/usr/bin/env node

import {Cli, Command} from 'clipanion';

import RunCommand     from './commands/RunCommand';
import SdkCommand     from './commands/SdkCommand';

const cli = new Cli({
  binaryLabel: `Yarn PnPify`,
  binaryName: `yarn pnpify`,
  binaryVersion: require(`@yarnpkg/pnpify/package.json`).version,
});

cli.register(RunCommand);
cli.register(SdkCommand);
cli.register(Command.Entries.Help);
cli.register(Command.Entries.Version);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
