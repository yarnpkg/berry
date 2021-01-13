#!/usr/bin/env node

import {Cli, Builtins}    from 'clipanion';

import BuildBundleCommand from './commands/build/bundle';
import BuildPluginCommand from './commands/build/plugin';
import ClipanionCommand   from './commands/clipanion';
import NewPluginCommand   from './commands/new/plugin';

const cli = new Cli({
  binaryLabel: `Yarn Builder`,
  binaryName: `builder`,
  binaryVersion: require(`@yarnpkg/builder/package.json`).version,
});

cli.register(NewPluginCommand);
cli.register(BuildBundleCommand);
cli.register(BuildPluginCommand);

cli.register(ClipanionCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
