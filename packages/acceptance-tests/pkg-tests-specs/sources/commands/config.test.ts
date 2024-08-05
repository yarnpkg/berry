import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';

const RC_FILENAME = `.yarnrc.yml`;
const SUBFOLDER = `subfolder`;
const FAKE_REGISTRY_URL = `http://yarn.test.registry`;
const FAKE_LOCAL_APP_DATA = `LOCAL_APP_DATA`;
const FAKE_WORKSPACE_ROOT = `WORKSPACE_ROOT`;
const FAKE_HOME = `HOME`;

const FILTER = [
  `initScope`,
  `lastUpdateCheck`,
  `defaultLanguageName`,
];

const environments: Record<string, (opts: {
  path: PortablePath;
  homePath: PortablePath;
}) => Promise<void>> = {
  [`folder without rcfile in ancestry`]: async () => {
    // Nothing to do
  },
  [`folder with rcfile`]: async ({path}) => {
    await xfs.writeFilePromise(ppath.join(path, `${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`), `initScope: my-test\n`);
  },
  [`folder with rcfile without trailing newline`]: async ({path}) => {
    await xfs.writeFilePromise(ppath.join(path, `${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`), `initScope: my-test`);
  },
  [`folder with rcfile and rc in parent`]: async ({path}) => {
    await xfs.writeFilePromise(ppath.join(path, `${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`), `initScope: my-test`);
    await xfs.writeFilePromise(ppath.join(path, `${SUBFOLDER}/${RC_FILENAME}`), `initScope: value-to-override\nlastUpdateCheck: 1555784893958\n`);
  },
  [`folder with rcfile and rc in ancestor parent`]: async ({path}) => {
    await xfs.writeFilePromise(ppath.join(path, `${SUBFOLDER}/${SUBFOLDER}/${RC_FILENAME}`), `initScope: my-test`);
    await xfs.writeFilePromise(ppath.join(path, `${RC_FILENAME}`), `initScope: value-to-override\nlastUpdateCheck: 1555784893958\n`);
  },
  [`folder with rcfile and rc in home folder`]: async ({path, homePath}) => {
    await xfs.writeFilePromise(ppath.join(homePath, RC_FILENAME), `initScope: my-test`);
    await xfs.writeFilePromise(ppath.join(path, `${RC_FILENAME}`), `initScope: my-test\nlastUpdateCheck: 1555784893958\n`);
  },
};

function cleanupPlainOutput(output: string, path: PortablePath, homePath: PortablePath) {
  // Replace multiple consecutive spaces with one space.
  // The output of the config command is aligned according to the longest value, which probably
  // contains `path`. In other words, the formatting depends on the length of `path`.
  output = output.replace(/  +/g, ` - `);

  // The JSON output contains escaped backslashes on Windows; we need to unescape them for
  // them to be matched against the paths in the two following replacements.
  output = output.replaceAll(`\\\\`, `\\`);

  // replace the generated workspace root with a constant
  output = output.replaceAll(npath.fromPortablePath(path), FAKE_WORKSPACE_ROOT);

  // replace the generated home folder with a constant
  output = output.replaceAll(npath.fromPortablePath(homePath), FAKE_HOME);

  // replace the windows backslashes by forward slashes
  output = output.replaceAll(`\\`, `/`);

  // replace the default global folder with a constant
  output = output.replace(/[^"]+\/\.?yarn\/berry/ig, FAKE_LOCAL_APP_DATA);

  return output;
}

function cleanupJsonOutput(output: string, path: PortablePath, homePath: PortablePath) {
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

  const pathN = npath.fromPortablePath(path);
  const homePathN = npath.fromPortablePath(homePath);

  const cleanPath = (input: string) => input
    .replaceAll(pathN, FAKE_WORKSPACE_ROOT)
    .replaceAll(homePathN, FAKE_HOME);

  for (const setting of Object.values<any>(outputObject)) {
    if (typeof setting.source === `string`)
      setting.source = cleanPath(setting.source);

    if (typeof setting.default === `string`)
      setting.default = cleanPath(setting.default);

    if (typeof setting.effective === `string`) {
      setting.effective = cleanPath(setting.effective);
    }
  }

  return JSON.stringify(outputObject);
}

const options = {
  [`without flags`]: {cleanupStdout: cleanupPlainOutput, flags: []},
  [`as json`]: {cleanupStdout: cleanupJsonOutput, flags: [`--json`]},
};

describe(`Commands`, () => {
  describe(`config`, () => {
    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [optionDescription, {flags, cleanupStdout}] of Object.entries(options)) {
        test(`test (${environmentDescription} / ${optionDescription})`, makeTemporaryEnv({}, async ({path, run, source}) => {
          const cwd = ppath.join(path, `${SUBFOLDER}/${SUBFOLDER}`);
          const homePath = await xfs.mktempPromise();

          await xfs.mkdirPromise(cwd, {recursive: true});
          await environment({path, homePath});

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`config`, ...flags, ...FILTER, {cwd, env: {HOME: homePath, USERPROFILE: homePath}}));
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
