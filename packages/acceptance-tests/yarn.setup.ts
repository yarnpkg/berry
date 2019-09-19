import {NodeFS}          from '@yarnpkg/fslib';
import isWsl             from 'is-wsl';
import {delimiter}       from 'path';

import {tests, exec, fs} from 'pkg-tests-core';
import {URL}             from 'url';

const {generatePkgDriver, startPackageServer, getPackageRegistry} = tests;
const {execFile} = exec;
const {createTemporaryFolder} = fs;

global.makeTemporaryEnv = generatePkgDriver({
  getName() {
    return `yarn`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, env, ...config},
  ) {
    const rcEnv = {};
    for (const key of Object.keys(config))
      rcEnv[`YARN_${key.replace(/([A-Z])/g, `_$1`).toUpperCase()}`] = config[key];

    const nativePath = NodeFS.fromPortablePath(path);
    const tempHomeFolder = NodeFS.fromPortablePath(await createTemporaryFolder());

    const cwdArgs = typeof projectFolder !== `undefined`
      ? [projectFolder]
      : [];

    const res = await execFile(process.execPath, [`${__dirname}/../../scripts/run-yarn.js`, ...cwdArgs, command, ...args], {
      cwd: cwd || path,
      env: {
        [`HOME`]: tempHomeFolder,
        [`USERPROFILE`]: tempHomeFolder,
        [`PATH`]: `${nativePath}/bin${delimiter}${process.env.PATH}`,
        [`TEST_ENV`]: `true`,
        [`YARN_GLOBAL_FOLDER`]: `${nativePath}/.yarn/global`,
        [`YARN_NPM_REGISTRY_SERVER`]: registryUrl,
        [`YARN_UNSAFE_HTTP_WHITELIST`]: new URL(registryUrl).hostname,
        // Otherwise the tests would break when C:\tmp is on a different drive than the repo
        [`YARN_ENABLE_ABSOLUTE_VIRTUALS`]: `true`,
        // Otherwise the output isn't stable between runs
        [`YARN_ENABLE_TIMERS`]: `false`,
        // Otherwise we would more often test the fallback rather than the real logic
        [`YARN_PNP_FALLBACK_MODE`]: `none`,
        ...rcEnv,
        ...env,
      },
    });

    if (process.env.JEST_LOG_SPAWNS) {
      console.log(`===== stdout:`);
      console.log(res.stdout);
      console.log(`===== stderr:`);
      console.log(res.stderr);
    }

    return res;
  },
});

if (process.platform === `win32` || isWsl || process.platform === `darwin`)
  jest.setTimeout(10000);


beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
