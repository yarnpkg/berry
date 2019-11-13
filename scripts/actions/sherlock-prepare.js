const {execFile} = require(`child_process`);
const {existsSync, promises: {mkdir, writeFile}} = require(`fs`);
const {resolve} = require(`path`);
const {promisify} = require(`util`);

const execFileP = promisify(execFile);

/**
 * Creates a package.json file in the current folder, and an `index.js` that
 * returns the content of this manifest.
 *
 * Ex: await packageJson({
 *   dependencies: {
 *     lodash: '*',
 *   },
 * });
 */
global.packageJson = async (data, {cwd = `.`} = {}) => {
  const target = resolve(cwd);
  await mkdir(target, {recursive: true});

  await writeFile(resolve(target, `package.json`), `${JSON.stringify(data, null, 2)}\n`);
  await writeFile(resolve(target, `index.js`), `module.exports = require('./package.json');`);
};

/**
 * Does the same thing as `packageJson`, but also calls `yarn install` right
 * after generating the files.
 *
 * Ex: await packageJsonAndInstall({
 *   dependencies: {
 *     lodash: '*',
 *   },
 * });
 */
global.packageJsonAndInstall = async (data, {cwd = `.`} = {}) => {
  await global.packageJson(data, {cwd});
  await global.yarn(`install`);
};

/**
 * Calls the right Yarn binary (which has been built from master).
 *
 * Ex: await yarn(`install`);
 */
global.yarn = async (...args) => {
  let opts;
  if (typeof args[args.length - 1] === `object`)
    opts = args.pop();

  const bundlePath = `${__dirname}/../../packages/yarnpkg-cli/bundles/yarn.js`;
  if (!existsSync(bundlePath))
    throw new Error(`The local CLI bundle must have been generated before calling this command`);

  const {stdout} = await execFileP(process.execPath, [bundlePath, ...args], {
    env: {...process.env, YARN_IGNORE_PATH: 1},
    ...opts,
  });

  return stdout;
};

/**
 * Spawns a Node process, executes the specified code, and returns whatever
 * it returned by converting it to and from JSON. Although single line scripts
 * are recommended, you can make them as complex as you want by wrapping your
 * code between a block enclosure.
 *
 * Ex: console.log(await node(`require.resolve('lodash')`))
 *
 * Ex: console.log(await node(`{
 *   const a = await ...;
 *   const b = await ...;
 *   return {a, b};
 * }`))
 */
global.node = async (source, opts = {}) => {
  return JSON.parse(await yarn(`node`, `-e`, `Promise.resolve().then(async () => ${source}).catch(err => err).then(res => console.log(JSON.stringify(res)))`, opts));
};
