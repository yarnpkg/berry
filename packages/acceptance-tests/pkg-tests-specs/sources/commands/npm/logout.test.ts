import {Filename, xfs} from '@yarnpkg/fslib';
import {yarn}          from 'pkg-tests-core';

const SPEC_RC_FILENAME = `.spec-yarnrc` as Filename;

const FAKE_FIRST_SCOPE = `first`;
const FAKE_SECOND_SCOPE = `second`;
const FAKE_THIRD_SCOPE = `third`;

const FAKE_REGISTRY_URL = `http://yarn.test.registry`;
const FAKE_PUBLISH_REGISTRY_URL = `https://npm.pkg.github.com`;
const FAKE_THIRD_REGISTRY_URL = `https://third.yarn.test.registry`;

const CLASSIC_SCOPE_SETTINGS = {
  npmAlwaysAuth: `true`,
};

const FAKE_REGISTRY_CREDENTIALS = {
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
        const homePath = await xfs.mktempPromise();

        await yarn.writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
          npmScopes: {
            [FAKE_FIRST_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {
          filename: SPEC_RC_FILENAME,
        });

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-expect-error
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

        await expect(yarn.readConfiguration(homePath, {
          filename: SPEC_RC_FILENAME,
        })).resolves.toStrictEqual({
          npmRegistries: {
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
          npmScopes: {
            [FAKE_FIRST_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
          },
        });

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from all registries and all scopes when the -A,--all flag is used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        const homePath = await xfs.mktempPromise();

        await yarn.writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
          npmScopes: {
            [FAKE_FIRST_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_SECOND_SCOPE]: CLASSIC_SCOPE_SETTINGS,
            [FAKE_THIRD_SCOPE]: {
              ...CLASSIC_SCOPE_SETTINGS,
              ...FAKE_REGISTRY_CREDENTIALS,
            },
          },
        }, {
          filename: SPEC_RC_FILENAME,
        });

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-expect-error
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

        await expect(yarn.readConfiguration(homePath, {
          filename: SPEC_RC_FILENAME,
        })).resolves.toStrictEqual({
          npmScopes: {
            [FAKE_SECOND_SCOPE]: CLASSIC_SCOPE_SETTINGS,
            [FAKE_THIRD_SCOPE]: CLASSIC_SCOPE_SETTINGS,
          },
        });

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    it(
      `should logout a user from the publish registry when the --publish flag is used`,
      makeTemporaryEnv({}, {
        npmRegistryServer: FAKE_REGISTRY_URL,
        npmPublishRegistry: FAKE_PUBLISH_REGISTRY_URL,
      }, async ({path, run, source}) => {
        const homePath = await xfs.mktempPromise();

        await yarn.writeConfiguration(homePath, {
          npmRegistries: {
            [FAKE_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_PUBLISH_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_THIRD_REGISTRY_URL]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {
          filename: SPEC_RC_FILENAME,
        });

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-expect-error
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

        await expect(yarn.readConfiguration(homePath, {
          filename: SPEC_RC_FILENAME,
        })).resolves.toStrictEqual({
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
        const homePath = await xfs.mktempPromise();

        await yarn.writeConfiguration(homePath, {
          npmScopes: {
            [FAKE_FIRST_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
            [FAKE_SECOND_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
          },
        }, {
          filename: SPEC_RC_FILENAME,
        });

        let code: number;
        let stdout: string;
        let stderr: string;

        try {
          // @ts-expect-error
          ({code, stdout, stderr} = await run(`npm`, `logout`, `--scope`, FAKE_FIRST_SCOPE, {
            env: {
              HOME: homePath,
              USERPROFILE: homePath,
              YARN_RC_FILENAME: SPEC_RC_FILENAME,
            },
          }));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        await expect(yarn.readConfiguration(homePath, {
          filename: SPEC_RC_FILENAME,
        })).resolves.toStrictEqual({
          npmScopes: {
            [FAKE_SECOND_SCOPE]: FAKE_REGISTRY_CREDENTIALS,
          },
        });

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );
  });
});
