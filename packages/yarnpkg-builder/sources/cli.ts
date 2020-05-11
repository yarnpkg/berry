#!/usr/bin/env node

import {Cli}              from 'clipanion';

import BuildBundleCommand from './commands/build/bundle';
import BuildPluginCommand from './commands/build/plugin';
import HelpCommand        from './commands/help';
import NewPluginCommand   from './commands/new/plugin';
import VersionCommand     from './commands/version';

const cli = new Cli({
  binaryName: `yarn builder`,
});

cli.register(NewPluginCommand);
cli.register(BuildBundleCommand);
cli.register(BuildPluginCommand);
cli.register(HelpCommand);
cli.register(VersionCommand);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
