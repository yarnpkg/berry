/* @flow */

const {delimiter} = require(`path`);

const {
  tests: {generatePkgDriver, startPackageServer, getPackageRegistry},
  exec: {execFile},
} = require(`pkg-tests-core`);

const {
  basic: basicSpecs,
  dragon: dragonSpecs,
  lock: lockSpecs,
  pnp: pnpSpecs,
  pnpapiV1: pnpapiV1Specs,
  script: scriptSpecs,
  workspace: workspaceSpecs,
} = require(`pkg-tests-specs`);

const pkgDriver = generatePkgDriver({
  getName() {
    return `berry`;
  },
  async runDriver(
    path,
    [command, ...args],
    {cwd, projectFolder, registryUrl, plugNPlay, plugnplayShebang, plugnplayBlacklist, env},
  ) {
    let beforeArgs = [];
    let middleArgs = [];

    if (projectFolder) {
      beforeArgs = [...beforeArgs, `--cwd`, projectFolder];
    }

    const res = await execFile(
      process.execPath,
      [`${__dirname}/../berry-cli/bin/berry.js`, ...beforeArgs, command, ...middleArgs, ...args],
      {
        env: Object.assign(
          {
            [`BERRY_CACHE_FOLDER`]: `${path}/.berry/cache`,
            [`BERRY_PNP_SHEBANG`]: plugnplayShebang,
//          [`BERRY_PNP_BLACKLIST`]: plugnplayBlacklist || ``,
            [`BERRY_REGISTRY_SERVER`]: registryUrl,
            [`PATH`]: `${path}/bin${delimiter}${process.env.PATH}`,
          },
          env,
        ),
        cwd: cwd || path,
      },
    );

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

basicSpecs(pkgDriver);
lockSpecs(pkgDriver);
scriptSpecs(pkgDriver);
workspaceSpecs(pkgDriver);
pnpSpecs(pkgDriver);
pnpapiV1Specs(pkgDriver);
dragonSpecs(pkgDriver);
