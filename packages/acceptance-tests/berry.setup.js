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
    {cwd, projectFolder, registryUrl, plugnplayShebang, plugnplayBlacklist, env},
  ) {
    if (projectFolder) args = [...args, `--cwd`, projectFolder];

    const res = await execFile(process.execPath, [`${__dirname}/../berry-cli/bin/berry.js`, command, ...args], {
      env: Object.assign(
        {
          [`BERRY_CACHE_FOLDER`]: `${path}/.berry/cache`,
          //          [`BERRY_PNP_BLACKLIST`]: plugnplayBlacklist || ``,
          [`BERRY_NPM_REGISTRY_SERVER`]: registryUrl,
          [`PATH`]: `${path}/bin${delimiter}${process.env.PATH}`,
        },
        plugnplayShebang && {
          [`BERRY_PNP_SHEBANG`]: plugnplayShebang,
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
