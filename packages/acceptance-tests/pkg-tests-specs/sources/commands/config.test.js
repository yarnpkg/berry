const {
  fs: {mkdirp, writeFile},
} = require('pkg-tests-core');
const {NodeFS} = require('@berry/fslib');

const RC_FILENAME = `.spec-yarnrc`;
const SUBFOLDER = `subfolder`;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;
const FAKE_WORKSPACE_ROOT = `WORKSPACE_ROOT`;

const environments = {
  [`folder without rcfile in ancestry`]: async () => {
    // Nothing to do
  },
  [`folder with rcfile`]: async path => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `init-scope berry-test\n`);
  },
  [`folder with rcfile without trailing newline`]: async path => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `init-scope berry-test`);
  },
  [`folder with rcfile and rc in parent`]: async path => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `init-scope berry-test\n`);
    await writeFile(`${path}/${SUBFOLDER}/${RC_FILENAME}`, `init-scope berry-test\nlastUpdateCheck 1555784893958\n`);
  },
  [`folder with rcfile and rc in ancestor parent`]: async path => {
    await writeFile(`${path}/${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`, `init-scope berry-test\n`);
    await writeFile(`${path}/${RC_FILENAME}`, `init-scope berry-test\nlastUpdateCheck 1555784893958\n`);
  },
};

function cleanupPlainOutput(output, path) {
  // Replace multiple consecutive spaces with one space.
  // The output of the config command is aligned according to the longest value, which probably
  // contains `path`. In other words, the formatting depends on the lengt of `path`.
  output = output.replace(/  +/g, ` - `);

  // replace the generated workspace root with a constant
  output = output.replace(new RegExp(path, `g`), FAKE_WORKSPACE_ROOT);

  // replace the generated registry server URL with a constant
  output = output.replace(/^(\s*npmRegistryServer.*?)(['"]?)http:\/\/localhost:\d+\2\s*$/mg, `$1$2${FAKE_REGISTRY_URL}$2`);

  return output;
}

function cleanupJsonOutput(output, path) {
  let outputObject;
  try {
    outputObject = JSON.parse(output);
  } catch (e) {
    return cleanupPlainOutput(output, path);
  }

  // the default globalFolder contains the user's home folder, override that value
  outputObject[`globalFolder`].default = `DEFAULT_GLOBAL_FOLDER`;
  
  // replace the generated registry server URL with a constant
  outputObject[`npmRegistryServer`].effective = FAKE_REGISTRY_URL;

  const pathRegExp = new RegExp(path, `g`);

  for (const setting of Object.values(outputObject)) {
    if (typeof setting.source === 'string')
      setting.source = setting.source.replace(pathRegExp, FAKE_WORKSPACE_ROOT);

    if (typeof setting.default === 'string')
      setting.default = setting.default.replace(pathRegExp, FAKE_WORKSPACE_ROOT);

    if (typeof setting.effective === 'string') {
      setting.effective = setting.effective.replace(pathRegExp, FAKE_WORKSPACE_ROOT);
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
          
          await mkdirp(cwd);
          await environment(path);

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`config`, ...flags, {
              env: {
                yarn_rc_filename: RC_FILENAME,
              },
              cwd,
            }));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          const portablePath = NodeFS.toPortablePath(path);

          stdout = cleanupStdout(stdout, portablePath);
          stderr = cleanupPlainOutput(stderr, portablePath);

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
