import {npath}     from '@yarnpkg/fslib';
import {delimiter} from 'path';

import * as exec   from './exec';
import * as tests  from './tests';

const {generatePkgDriver} = tests;
const {execFile} = exec;

const mte = generatePkgDriver({
  getName() {
    return `yarn`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, execArgv = [], projectFolder, registryUrl, env, stdin, ...config},
  ) {
    const rcEnv: Record<string, any> = {};
    for (const [key, value] of Object.entries(config))
      rcEnv[`YARN_${key.replace(/([A-Z])/g, `_$1`).toUpperCase()}`] = Array.isArray(value) ? value.join(`;`) : value;

    const nativePath = npath.fromPortablePath(path);
    const nativeHomePath = npath.dirname(nativePath);

    const cwdArgs = typeof projectFolder !== `undefined`
      ? [projectFolder]
      : [];

    const yarnBinary = process.env.TEST_BINARY
      ?? require.resolve(`${__dirname}/../../../../yarnpkg-cli/bundles/yarn.js`);

    const res = await execFile(process.execPath, [...execArgv, yarnBinary, ...cwdArgs, command, ...args], {
      cwd: cwd || path,
      stdin,
      env: {
        [`HOME`]: nativeHomePath,
        [`USERPROFILE`]: nativeHomePath,
        [`PATH`]: `${nativePath}/bin${delimiter}${process.env.PATH}`,
        [`RUST_BACKTRACE`]: `1`,
        [`YARN_IS_TEST_ENV`]: `true`,
        [`YARN_GLOBAL_FOLDER`]: `${nativePath}/.yarn/global`,
        [`YARN_NPM_REGISTRY_SERVER`]: registryUrl,
        [`YARN_UNSAFE_HTTP_WHITELIST`]: new URL(registryUrl).hostname,
        // Otherwise we'd send telemetry event when running tests
        [`YARN_ENABLE_TELEMETRY`]: `0`,
        // Otherwise snapshots relying on this would break each time it's bumped
        [`YARN_CACHE_VERSION_OVERRIDE`]: `0`,
        // Otherwise the output isn't stable between runs
        [`YARN_ENABLE_PROGRESS_BARS`]: `false`,
        [`YARN_ENABLE_TIMERS`]: `false`,
        [`FORCE_COLOR`]: `0`,
        // Otherwise the output wouldn't be the same on CI vs non-CI
        [`YARN_ENABLE_INLINE_BUILDS`]: `true`,
        // Otherwise we would more often test the fallback rather than the real logic
        [`YARN_PNP_FALLBACK_MODE`]: `none`,
        // Otherwise tests fail on systems where this is globally set to true
        [`YARN_ENABLE_GLOBAL_CACHE`]: `false`,
        // Older versions of Windows need this set to not have node throw an error
        [`NODE_SKIP_PLATFORM_CHECK`]: `1`,
        // We don't want the PnP runtime to be accidentally injected
        [`NODE_OPTIONS`]: ``,
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
