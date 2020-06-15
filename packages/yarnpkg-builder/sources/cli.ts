#!/usr/bin/env node

import {Cli, Command}     from 'clipanion';

import BuildBundleCommand from './commands/build/bundle';
import BuildPluginCommand from './commands/build/plugin';
import NewPluginCommand   from './commands/new/plugin';

const cli = new Cli({
  binaryLabel: `Yarn Builder`,
  binaryName: `builder`,
  binaryVersion: require(`@yarnpkg/builder/package.json`).version,
});

cli.register(NewPluginCommand);
cli.register(BuildBundleCommand);
cli.register(BuildPluginCommand);

cli.register(Command.Entries.Help);
cli.register(Command.Entries.Version);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
