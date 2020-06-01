import {Filename} from '@yarnpkg/fslib';
import {fs, yarn} from 'pkg-tests-core';

const {createTemporaryFolder} = fs;
const {writeConfiguration, readConfiguration} = yarn;

const SPEC_RC_FILENAME = `.spec-yarnrc` as Filename;

const FAKE_REGISTRY_URL = `http://yarn.test.registry`;
const FAKE_PUBLISH_REGISTRY_URL = `https://npm.pkg.github.com`;
const FAKE_THIRD_REGISTRY_URL = `https://third.yarn.test.registry`;
const FAKE_FOURTH_REGISTRY_URL = `https://fourth.yarn.test.registry`;

const FAKE_REGISTRY_CREDENTIALS = {
  npmAlwaysAuth: `true`,
  npmAuthIdent: `username:password`,
  npmAuthToken: `ffffffff-ffff-ffff-ffff-ffffffffffff`,
};

describe(`Commands`, () => {
  describe(`npm logout`, () => {
    it(
      `should logout a user from the default registry when no arguments are passed`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        const homePath = await createTemporaryFolder();
        await writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {filename: SPEC_RC_FILENAME});

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-ignore
          ({code, stdout, stderr} = await run(`npm`, `logout`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(readConfiguration(homePath, {filename: SPEC_RC_FILENAME})).resolves.toStrictEqual({
          npmRegistries: {
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        });
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from all registries when the -A,--all flag is used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        const homePath = await createTemporaryFolder();
        await writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {filename: SPEC_RC_FILENAME});

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-ignore
          ({code, stdout, stderr} = await run(`npm`, `logout`, `--all`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(readConfiguration(homePath, {filename: SPEC_RC_FILENAME})).resolves.toStrictEqual({});
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from the publish registry when the --publish flag is used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        const homePath = await createTemporaryFolder();
        await writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {filename: SPEC_RC_FILENAME});

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-ignore
          ({code, stdout, stderr} = await run(`npm`, `logout`, `--publish`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(readConfiguration(homePath, {filename: SPEC_RC_FILENAME})).resolves.toStrictEqual({
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        });
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from the scope registry when the -s,--scope flag is used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        // This can't be set in the subdefinition :(
        await writeConfiguration(path, {
          npmScopes: {
            yarnpkg: {
              npmRegistryServer: FAKE_THIRD_REGISTRY_URL,
              npmPublishRegistry: FAKE_FOURTH_REGISTRY_URL,
            },
          },
        }, {filename: SPEC_RC_FILENAME});

        const homePath = await createTemporaryFolder();
        await writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_FOURTH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {filename: SPEC_RC_FILENAME});

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-ignore
          ({code, stdout, stderr} = await run(`npm`, `logout`, `--scope`, `yarnpkg`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(readConfiguration(homePath, {filename: SPEC_RC_FILENAME})).resolves.toStrictEqual({
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_FOURTH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        });
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from the scope publish registry when the -s,--scope and --publish flags are used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        // This can't be set in the subdefinition :(
        await writeConfiguration(path, {
          npmScopes: {
            yarnpkg: {
              npmRegistryServer: FAKE_THIRD_REGISTRY_URL,
              npmPublishRegistry: FAKE_FOURTH_REGISTRY_URL,
            },
          },
        }, {filename: SPEC_RC_FILENAME});

        const homePath = await createTemporaryFolder();
        await writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_FOURTH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {filename: SPEC_RC_FILENAME});

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-ignore
          ({code, stdout, stderr} = await run(`npm`, `logout`, `--publish`, `--scope`, `yarnpkg`, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(readConfiguration(homePath, {filename: SPEC_RC_FILENAME})).resolves.toStrictEqual({
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        });
        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );
  });
});
