#!/usr/bin/env node

import {npath, NativePath, ppath, xfs, Filename} from '@yarnpkg/fslib';
import crossSpawn                                from 'cross-spawn';

import {dynamicRequire}                          from './dynamicRequire';
import {generateSdk}                             from './generateSdk';

const [,, name, ...rest] = process.argv;

if (name === `--help` || name === `-h`)
  help(false);
else if (name === `--sdk` && rest.length === 0)
  sdk(process.cwd());
else if (name === `--sdk` && rest.length === 1)
  sdk(rest[0]);
else if (typeof name !== `undefined` && name[0] !== `-`)
  run(name, rest);
else
  help(true);

function help(error: boolean) {
  const logFn = error ? console.error : console.log;
  process.exitCode = error ? 1 : 0;

  logFn(`Usage: yarn pnpify --sdk [path?]`);
  logFn(`Usage: yarn pnpify <program> [...argv]`);
  logFn();
  logFn(`Setups a TypeScript sdk for use within your VSCode editor instance`);
  logFn(`More info at https://yarnpkg.com/advanced/pnpify`);
}

function sdk(cwd: NativePath) {
  let nextProjectRoot = npath.toPortablePath(cwd);
  let currProjectRoot = null;

  let isCJS = '';
  while (nextProjectRoot !== currProjectRoot) {
    currProjectRoot = nextProjectRoot;
    nextProjectRoot = ppath.dirname(currProjectRoot);

    if (xfs.existsSync(ppath.join(currProjectRoot, `.pnp.js` as Filename)))
      break;

    if (xfs.existsSync(ppath.join(currProjectRoot, `.pnp.cjs` as Filename))) {
      isCJS = 'c';
      break;
    }
  }

  if (nextProjectRoot === currProjectRoot)
    throw new Error(`This tool can only be used with projects using Yarn Plug'n'Play`);

  const pnpPath = ppath.join(currProjectRoot, `.pnp.${isCJS}js` as Filename);
  const pnpApi = dynamicRequire(pnpPath);

  generateSdk(pnpApi).catch(error => {
    console.error(error.stack);
    process.exitCode = 1;
  });
}

function run(name: string, argv: Array<string>) {
  let {NODE_OPTIONS} = process.env;
  NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${dynamicRequire.resolve(`@yarnpkg/pnpify`)}`.trim();

  const child = crossSpawn(name, argv, {
    env: {...process.env, NODE_OPTIONS},
    stdio: `inherit`,
  });

  child.on(`exit`, code => {
    process.exitCode = code !== null ? code : 1;
  });
}
