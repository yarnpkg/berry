#!/usr/bin/env node

import {Cli}          from 'clipanion';

import EntryCommand   from './commands/entry';
import HelpCommand    from './commands/help';
import VersionCommand from './commands/version';

const cli = new Cli({
  binaryLabel: `Yarn Shell`,
  binaryName: `yarn shell`,
  binaryVersion: require(`@yarnpkg/shell/package.json`).version || `<unknown>`,
});

cli.register(EntryCommand);
cli.register(HelpCommand);
cli.register(VersionCommand);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
