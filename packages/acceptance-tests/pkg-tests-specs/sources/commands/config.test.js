const {
  fs: {mkdirp, writeFile, createTemporaryFolder},
} = require(`pkg-tests-core`);

const RC_FILENAME = `.spec-yarnrc`;
const SUBFOLDER = `subfolder`;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;
const FAKE_LOCAL_APP_DATA = `LOCAL_APP_DATA`;
const FAKE_WORKSPACE_ROOT = `WORKSPACE_ROOT`;
const FAKE_HOME = `HOME`;

const FILTER = new RegExp([
  `initScope`,
  `lastUpdateCheck`,
  `defaultLanguageName`,
].join(`|`));

const environments = {
  [`folder without rcfile in ancestry`]: async () => {
    // Nothing to do
  },
  [`folder with rcfile`]: async ({path}) => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `initScope: my-test\n`);
  },
  [`folder with rcfile without trailing newline`]: async ({path}) => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `initScope: my-test`);
  },
  [`folder with rcfile and rc in parent`]: async ({path}) => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `initScope: my-test\n`);
    await writeFile(`${path}/${SUBFOLDER}/${RC_FILENAME}`, `initScope: value-to-override\nlastUpdateCheck: 1555784893958\n`);
  },
  [`folder with rcfile and rc in ancestor parent`]: async ({path}) => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `initScope: my-test\n`);
    await writeFile(`${path}/${RC_FILENAME}`, `initScope: value-to-override\nlastUpdateCheck: 1555784893958\n`);
  },
  [`folder with rcfile and rc in home folder`]: async ({path, homePath}) => {
    await writeFile(`${homePath}/${RC_FILENAME}`, `initScope: value-to-override\ndefaultLanguageName: python\n`);
    await writeFile(`${path}/${RC_FILENAME}`, `initScope: my-test\nlastUpdateCheck: 1555784893958\n`);
  },
};

function cleanupPlainOutput(output, path, homePath) {
  // Replace multiple consecutive spaces with one space.
  // The output of the config command is aligned according to the longest value, which probably
  // contains `path`. In other words, the formatting depends on the length of `path`.
  output = output.replace(/  +/g, ` - `);

  // replace the generated workspace root with a constant
  output = output.replace(new RegExp(path, `g`), FAKE_WORKSPACE_ROOT);

  // replace the generated home folder with a constant
  output = output.replace(new RegExp(homePath, `g`), FAKE_HOME);

  // replace the generated registry server URL with a constant
  output = output.replace(/http:\/\/localhost:\d+/g, FAKE_REGISTRY_URL);

  // replace the default global folder with a constant
  output = output.replace(/[^"]+\/\.?yarn\/berry/ig, FAKE_LOCAL_APP_DATA);

  output = output.split(/\n/).filter(line => {
    return line.match(FILTER) !== null;
  }).join(`\n`);

  return output;
}

function cleanupJsonOutput(output, path, homePath) {
  let outputObject;
  try {
    outputObject = JSON.parse(output);
  } catch (e) {
    return cleanupPlainOutput(output, path, homePath);
  }

  // the default globalFolder contains the user's home folder, override that value
  outputObject.globalFolder.default = `DEFAULT_GLOBAL_FOLDER`;

  // replace the generated registry server URL with a constant
  outputObject.npmRegistryServer.effective = FAKE_REGISTRY_URL;

  const pathRegExp = new RegExp(path, `g`);
  const homePathRegExp = new RegExp(homePath, `g`);

  for (const setting of Object.values(outputObject)) {
    if (typeof setting.source === `string`) {
      setting.source = setting.source.replace(pathRegExp, FAKE_WORKSPACE_ROOT);
      setting.source = setting.source.replace(homePathRegExp, FAKE_HOME);
    }

    if (typeof setting.default === `string`) {
      setting.default = setting.default.replace(pathRegExp, FAKE_WORKSPACE_ROOT);
      setting.default = setting.default.replace(homePathRegExp, FAKE_HOME);
    }

    if (typeof setting.effective === `string`) {
      setting.effective = setting.effective.replace(pathRegExp, FAKE_WORKSPACE_ROOT);
      setting.effective = setting.effective.replace(homePathRegExp, FAKE_HOME);
    }
  }

  return JSON.stringify(outputObject);
}

const options = {
  [`without flags`]: {cleanupStdout: cleanupPlainOutput, flags: []},
  [`showing the source`]: {cleanupStdout: cleanupPlainOutput, flags: [`--why`]},
  [`showing explanation`]: {cleanupStdout: cleanupPlainOutput, flags: [`--verbose`]},
  [`as json`]: {cleanupStdout: cleanupJsonOutput, flags: [`--json`]},
};

describe(`Commands`, () => {
  describe(`config`, () => {
    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [optionDescription, {flags, cleanupStdout}] of Object.entries(options)) {
        test(`test (${environmentDescription} / ${optionDescription})`, makeTemporaryEnv({}, async ({path, run, source}) => {
          const cwd = `${path}/${SUBFOLDER}/${SUBFOLDER}`;
          const homePath = await createTemporaryFolder();

          await mkdirp(cwd);
          await environment({path, homePath});

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`config`, ...flags, {cwd, env: {YARN_RC_FILENAME: RC_FILENAME, HOME: homePath, USERPROFILE: homePath}}));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          stdout = cleanupStdout(stdout, path, homePath);
          stderr = cleanupPlainOutput(stderr, path, homePath);

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
