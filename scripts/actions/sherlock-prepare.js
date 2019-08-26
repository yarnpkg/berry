const {execFile} = require(`child_process`);
const {existsSync, promises: {writeFile}} = require(`fs`);
const {promisify} = require(`util`);

const execFileP = promisify(execFile);

global.packageJson = async (data) => {
  await writeFile(`package.json`, `${JSON.stringify(data, null, 2)}\n`);
};

global.packageJsonAndInstall = async (data) => {
  await global.packageJson(data);
  await global.yarn(`install`);
};

global.yarn = async (...args) => {
  const bundlePath = `${__dirname}/../../packages/yarnpkg-cli/bundles/yarn.js`;
  if (!existsSync(bundlePath))
    throw new Error(`The local CLI bundle must have been generated before calling this command`);

  const {stdout} = await execFileP(process.execPath, [bundlePath, ...args], {
    env: {...process.env, YARN_IGNORE_PATH: 1},
  });

  return stdout;
};

global.node = async (source) => {
  return JSON.parse(await yarn(`node`, `-p`, `JSON.stringify((() => ${source})())`));
};
