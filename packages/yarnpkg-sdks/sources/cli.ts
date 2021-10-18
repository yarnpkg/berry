#!/usr/bin/env node

import {Cli, Builtins} from 'clipanion';

import SdkCommand      from './commands/SdkCommand';

const cli = new Cli({
  binaryLabel: `Yarn SDKs`,
  binaryName: `sdks`,
  binaryVersion: require(`@yarnpkg/sdks/package.json`).version,
});

cli.register(SdkCommand);

cli.register(Builtins.DefinitionsCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

cli.runExit(process.argv.slice(2), Cli.defaultContext);
