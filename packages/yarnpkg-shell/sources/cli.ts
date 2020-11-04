#!/usr/bin/env node

import {Cli, Command} from 'clipanion';

import EntryCommand   from './commands/entry';

const cli = new Cli({
  binaryLabel: `Yarn Shell`,
  binaryName: `yarn shell`,
  binaryVersion: require(`@yarnpkg/shell/package.json`).version || `<unknown>`,
});

cli.register(EntryCommand);
cli.register(Command.Entries.Help);
cli.register(Command.Entries.Version);

cli.runExit(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
