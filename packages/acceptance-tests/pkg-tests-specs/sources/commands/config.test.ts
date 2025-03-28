import {PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';

const RC_FILENAME = `.yarnrc.yml`;
const SUBFOLDER = `subfolder`;
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

function cleanupOutput(output: string, path: PortablePath, homePath: PortablePath) {
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

const options = {
  [`without flags`]: {flags: []},
  [`as json`]: {flags: [`--json`]},
  [`no defaults`]: {flags: [`--no-defaults`]},
  [`as json no defaults`]: {flags: [`--json`, `--no-defaults`]},
};

describe(`Commands`, () => {
  describe(`config`, () => {
    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [optionDescription, {flags}] of Object.entries(options)) {
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

          stdout = cleanupOutput(stdout, path, homePath);
          stderr = cleanupOutput(stderr, path, homePath);

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
