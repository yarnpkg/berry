const {execFile} = require(`child_process`);
const {promises: {writeFile}} = require(`fs`);
const {promisify} = require(`util`);

const execFileP = promisify(execFile);

global.packageJson = async (data) => {
    await writeFile(`package.json`, JSON.stringify(data, null, 2) + `\n`);
};

global.packageJsonAndInstall = async (data) => {
    await global.packageJson(data);
    await global.yarn(`install`);
};

global.yarn = async (...args) => {
    const {stdout} = await execFileP(process.execPath, [`${__dirname}/../../packages/berry-cli/bin/berry.js`, ...args], {
        env: {...process.env, YARN_IGNORE_PATH: 1},
    });

    return stdout;
};

global.node = async (source) => {
    return JSON.parse(await yarn(`node`, `-p`, `JSON.stringify((() => ${source})())`));
};
