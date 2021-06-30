#!/usr/bin/env node

import crossSpawn       from 'cross-spawn';

import {dynamicRequire} from './dynamicRequire';

const [,, name, ...rest] = process.argv;

if (name === `--help` || name === `-h`)
  help(false);
else if (name === `--sdk`)
  sdk();
else if (typeof name !== `undefined` && name[0] !== `-`)
  run(name, rest);
else
  help(true);

function help(error: boolean) {
  const logFn = error ? console.error : console.log;
  process.exitCode = error ? 1 : 0;

  logFn(`Usage: yarn pnpify <program> [...argv]`);
  logFn();
  logFn(`Runs a JavaScript tool with in-memory node_modules from PnP install`);
}

function sdk() {
  const logFn = console.error;

  logFn(`Please use '@yarnpkg/sdks' package to install editor integrations`);
}

function run(name: string, argv: Array<string>) {
  let {NODE_OPTIONS} = process.env;
  NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${dynamicRequire.resolve(`@yarnpkg/pnpify`)}`.trim();

  const child = crossSpawn(name, argv, {
    env: {...process.env, NODE_OPTIONS},
    stdio: `inherit`,
  });

  child.on(`exit`, (code: number) => {
    process.exitCode = code !== null ? code : 1;
  });
}
