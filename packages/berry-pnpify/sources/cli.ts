import {NodeFS}         from '@berry/fslib';
import crossSpawn       from 'cross-spawn';

import {dynamicRequire} from './dynamicRequire';
import {generateSdk}    from './generateSdk';

const [,, name, ...rest] = process.argv;

if (name === `--help` || name === `-h`)
  help(false);
else if (name === `--sdk` && rest.length === 0)
  sdk();
else if (typeof name !== `undefined` && name[0] !== `-`)
  run(name, rest);
else
  help(true);


function help(error: boolean) {
  const logFn = error ? console.error : console.log;
  process.exitCode = error ? 1 : 0;

  logFn(`Usage: yarn pnpify --sdk`);
  logFn(`Usage: yarn pnpify <program> [...argv]`);
  logFn();
  logFn(`Setups a TypeScript sdk for use within your VSCode editor instance`);
  logFn(`More info at https://yarnpkg.github.io/berry/advanced/pnpify`);
}

function sdk() {
  const {getPackageInformation, topLevel} = dynamicRequire(`pnpapi`);
  const {packageLocation} = getPackageInformation(topLevel);

  const projectRoot = NodeFS.toPortablePath(packageLocation);

  generateSdk(projectRoot).catch(error => {
    console.error(error.stack);
    process.exitCode = 1;
  });
}

function run(name: string, argv: Array<string>) {
  let {NODE_OPTIONS} = process.env;
  NODE_OPTIONS = `${NODE_OPTIONS || ``} --require ${dynamicRequire.resolve(`@berry/pnpify`)}`.trim();

  const child = crossSpawn(name, argv, {
    env: {...process.env, NODE_OPTIONS},
    stdio: `inherit`,
  });

  child.on(`exit`, code => {
    process.exitCode = code !== null ? code : 1;
  });
}
