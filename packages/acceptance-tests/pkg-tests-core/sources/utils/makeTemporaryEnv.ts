import {npath}     from '@yarnpkg/fslib';
import {delimiter} from 'path';

import {URL}       from 'url';

import * as exec   from './exec';
import * as fs     from './fs';
import * as tests  from './tests';

const {generatePkgDriver} = tests;
const {execFile} = exec;
const {createTemporaryFolder} = fs;

const mte = generatePkgDriver({
  getName() {
    return `yarn`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, env, ...config},
  ) {
    const rcEnv: Record<string, any> = {};
    for (const key of Object.keys(config))
      rcEnv[`YARN_${key.replace(/([A-Z])/g, `_$1`).toUpperCase()}`] = config[key];

    const nativePath = npath.fromPortablePath(path);
    const tempHomeFolder = npath.fromPortablePath(await createTemporaryFolder());

    const cwdArgs = typeof projectFolder !== `undefined`
      ? [projectFolder]
      : [];

    const yarnBinary = require.resolve(`${__dirname}/../../../../yarnpkg-cli/bundles/yarn.js`);
    const res = await execFile(process.execPath, [yarnBinary, ...cwdArgs, command, ...args], {
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
        [`YARN_ENABLE_PROGRESS_BARS`]: `false`,
        // Otherwise the output wouldn't be the same on CI vs non-CI
        [`YARN_ENABLE_INLINE_BUILDS`]: `false`,
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

(global as any).makeTemporaryEnv = mte;

declare global {
  var makeTemporaryEnv: typeof mte;
}
