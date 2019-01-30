/* @flow */

const {delimiter} = require(`path`);

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
} = require(`pkg-tests-core`);

global.makeTemporaryEnv = generatePkgDriver({
  getName() {
    return `berry`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, env, ...config},
  ) {
    if (projectFolder) {
      args = [...args, `--cwd`, projectFolder];
    }

    const rcEnv = {};

    for (const [key, value] of Object.entries(config)) {
      rcEnv[`BERRY_${key.replace(/([A-Z])/g, `_$1`).toUpperCase()}`] = value;
    }

    const res = await execFile(process.execPath, [`${__dirname}/../berry-cli/bin/berry.js`, command, ...args], {
      env: Object.assign(
        {
          [`PATH`]: `${path}/bin${delimiter}${process.env.PATH}`,
          [`BERRY_CACHE_FOLDER`]: `${path}/.berry/cache`,
          [`BERRY_NPM_REGISTRY_SERVER`]: registryUrl,
          ...rcEnv,
        },
        env,
      ),
      cwd: cwd || path,
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

if (process.platform === `win32`) {
  jest.setTimeout(10000);
}

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
