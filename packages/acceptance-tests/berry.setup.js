/* @flow */

const {delimiter} = require(`path`);
const isWsl = require(`is-wsl`);

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
  fs: {createTemporaryFolder},
} = require(`pkg-tests-core`);
const {NodeFS} = require('@berry/fslib');

global.makeTemporaryEnv = generatePkgDriver({
  getName() {
    return `yarn`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, env, ...config},
  ) {
    if (projectFolder)
      args = [...args, `--cwd`, projectFolder];

    const rcEnv = {};
    for (const [key, value] of Object.entries(config))
      rcEnv[`YARN_${key.replace(/([A-Z])/g, `_$1`).toUpperCase()}`] = value;

    const nativePath = NodeFS.fromPortablePath(path);
    const tempHomeFolder = await createTemporaryFolder();

    const res = await execFile(process.execPath, [`${__dirname}/../../scripts/run-yarn.js`, command, ...args], {
      cwd: cwd || path,
      env: {
        [`HOME`]: tempHomeFolder,
        [`USERPROFILE`]: tempHomeFolder,
        [`PATH`]: `${nativePath}/bin${delimiter}${process.env.PATH}`,
        [`TEST_ENV`]: `true`,
        [`YARN_ENABLE_ABSOLUTE_VIRTUALS`]: `true`,
        [`YARN_ENABLE_TIMERS`]: `false`,
        [`YARN_GLOBAL_FOLDER`]: `${nativePath}/.berry/global`,
        [`YARN_NPM_REGISTRY_SERVER`]: registryUrl,
        ... rcEnv,
        ... env,
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

if (process.platform === `win32` || isWsl) {
  jest.setTimeout(10000);
}

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
