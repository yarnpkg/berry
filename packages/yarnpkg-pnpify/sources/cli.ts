#!/usr/bin/env node

import {Cli, Builtins}  from 'clipanion';

import ClipanionCommand from './commands/ClipanionCommand';
import RunCommand       from './commands/RunCommand';

const cli = new Cli({
  binaryLabel: `Yarn PnPify`,
  binaryName: `pnpify`,
  binaryVersion: require(`@yarnpkg/pnpify/package.json`).version,
});

cli.register(RunCommand);
// TODO: use the builtin entry once https://github.com/arcanis/clipanion/pull/91 is merged
cli.register(ClipanionCommand);

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
