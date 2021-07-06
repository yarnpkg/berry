#!/usr/bin/env node

import {Cli, Builtins}  from 'clipanion';

import ClipanionCommand from './commands/ClipanionCommand';
import SdkCommand       from './commands/SdkCommand';

const cli = new Cli({
  binaryLabel: `Yarn SDKs`,
  binaryName: `sdks`,
  binaryVersion: require(`@yarnpkg/sdks/package.json`).version,
});

cli.register(SdkCommand);
// TODO: use the builtin entry once https://github.com/arcanis/clipanion/pull/91 is merged
cli.register(ClipanionCommand);

cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
