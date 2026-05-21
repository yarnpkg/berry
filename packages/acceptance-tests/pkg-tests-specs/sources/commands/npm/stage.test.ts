const {
  misc,
  tests: {validLogins},
} = require(`pkg-tests-core`);

function extractStageId(jsonStdout: string): string {
  const jsonObjects = misc.parseJsonStream(jsonStdout);
  const result = jsonObjects.find((obj: any) => obj?.stageId);
  if (!result)
    throw new Error(`Could not find stageId in JSON output:\n${jsonStdout}`);

  return result.stageId;
}

describe(`Commands`, () => {
  describe(`npm stage`, () => {
    describe(`publish --staged`, () => {
      test(
        `it should stage a package for later approval`,
        makeTemporaryEnv({
          name: `staged-pkg`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout} = await run(`npm`, `publish`, `--staged`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`Staging to`);
          expect(stdout).toContain(`staged for approval`);
        }),
      );

      test(
        `it should not require OTP for staged publishing`,
        makeTemporaryEnv({
          name: `staged-otp-pkg`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout} = await run(`npm`, `publish`, `--staged`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`staged for approval`);
        }),
      );

      test(
        `it should support --dry-run with --staged`,
        makeTemporaryEnv({
          name: `staged-dry-run`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout} = await run(`npm`, `publish`, `--staged`, `--dry-run`, `--tolerate-republish`);
          expect(stdout).toContain(`Staging to`);
          expect(stdout).toContain(`dry run`);
        }),
      );

      test(
        `it should support --json with --staged`,
        makeTemporaryEnv({
          name: `staged-json`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout} = await run(`npm`, `publish`, `--staged`, `--json`, `--dry-run`, `--tolerate-republish`);
          const jsonObjects = misc.parseJsonStream(stdout);
          const result = jsonObjects.find((obj: any) => obj?.name && obj?.version);

          expect(result).toBeDefined();
          expect(result).toHaveProperty(`staged`, true);
          expect(result).toHaveProperty(`published`, false);
        }),
      );

      test(
        `it should fail without authentication`,
        makeTemporaryEnv({
          name: `staged-no-auth`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `publish`, `--staged`)).rejects.toThrow();
        }),
      );
    });

    describe(`list`, () => {
      test(
        `it should list an empty list when no packages are staged`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          const {stdout} = await run(`npm`, `stage`, `list`, `no-such-staged-pkg`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`No staged versions found`);
        }),
      );

      test(
        `it should list staged packages after staging one`,
        makeTemporaryEnv({
          name: `list-after-stage`,
          version: `2.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          await run(`npm`, `publish`, `--staged`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const {stdout} = await run(`npm`, `stage`, `list`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`list-after-stage`);
          expect(stdout).toContain(`2.0.0`);
        }),
      );

      test(
        `it should filter by package name`,
        makeTemporaryEnv({
          name: `filter-test-pkg`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          await run(`npm`, `publish`, `--staged`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const {stdout: matchOutput} = await run(`npm`, `stage`, `list`, `filter-test-pkg`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(matchOutput).toContain(`filter-test-pkg`);

          const {stdout: noMatchOutput} = await run(`npm`, `stage`, `list`, `nonexistent-pkg`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(noMatchOutput).toContain(`No staged versions found`);
        }),
      );

      test(
        `it should fail without authentication`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `list`)).rejects.toThrow();
        }),
      );
    });

    describe(`approve`, () => {
      test(
        `it should approve a staged package`,
        makeTemporaryEnv({
          name: `approve-test`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout: publishOut} = await run(`npm`, `publish`, `--staged`, `--json`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const stageId = extractStageId(publishOut);

          const {stdout} = await run(`npm`, `stage`, `approve`, stageId, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`approved and published successfully`);
        }),
      );

      test(
        `it should approve with OTP`,
        makeTemporaryEnv({
          name: `approve-otp-test`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout: publishOut} = await run(`npm`, `publish`, `--staged`, `--json`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const stageId = extractStageId(publishOut);

          const {stdout} = await run(`npm`, `stage`, `approve`, stageId, `--otp`, validLogins.otpUser.npmOtpToken, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`approved and published successfully`);
        }),
      );

      test(
        `it should fail with invalid stage ID format`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `approve`, `not-a-uuid`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          })).rejects.toThrow(/expected to match the pattern/);
        }),
      );

      test(
        `it should fail with non-existent stage ID`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `approve`, `1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          })).rejects.toThrow();
        }),
      );

      test(
        `it should fail without authentication`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `approve`, `1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f`)).rejects.toThrow();
        }),
      );
    });

    describe(`reject`, () => {
      test(
        `it should reject a staged package`,
        makeTemporaryEnv({
          name: `reject-test`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout: publishOut} = await run(`npm`, `publish`, `--staged`, `--json`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const stageId = extractStageId(publishOut);

          const {stdout} = await run(`npm`, `stage`, `reject`, stageId, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          expect(stdout).toContain(`has been rejected`);
        }),
      );

      test(
        `it should fail with invalid stage ID format`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `reject`, `not-a-uuid`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          })).rejects.toThrow(/expected to match the pattern/);
        }),
      );

      test(
        `it should fail with non-existent stage ID`,
        makeTemporaryEnv({}, async ({path, run}) => {
          await run(`install`);

          await expect(run(`npm`, `stage`, `reject`, `1de6f3db-2ed9-4d72-b3dd-8f0e2b474a2f`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          })).rejects.toThrow();
        }),
      );
    });

    describe(`full workflow`, () => {
      test(
        `it should support a stage -> list -> approve workflow`,
        makeTemporaryEnv({
          name: `workflow-approve`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout: publishOut} = await run(`npm`, `publish`, `--staged`, `--json`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const stageId = extractStageId(publishOut);

          // List and verify it appears
          const {stdout: listOut} = await run(`npm`, `stage`, `list`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });
          expect(listOut).toContain(`workflow-approve`);
          expect(listOut).toContain(stageId);

          // Approve
          await run(`npm`, `stage`, `approve`, stageId, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          // Verify it's gone from the list
          const {stdout: listAfter} = await run(`npm`, `stage`, `list`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });
          expect(listAfter).not.toContain(stageId);
        }),
      );

      test(
        `it should support a stage -> list -> reject workflow`,
        makeTemporaryEnv({
          name: `workflow-reject`,
          version: `1.0.0`,
        }, async ({path, run}) => {
          await run(`install`);

          const {stdout: publishOut} = await run(`npm`, `publish`, `--staged`, `--json`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          const stageId = extractStageId(publishOut);

          // List and verify it appears
          const {stdout: listOut} = await run(`npm`, `stage`, `list`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });
          expect(listOut).toContain(`workflow-reject`);

          // Reject
          await run(`npm`, `stage`, `reject`, stageId, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });

          // Verify it's gone from the list
          const {stdout: listAfter} = await run(`npm`, `stage`, `list`, {
            env: {
              YARN_NPM_AUTH_TOKEN: validLogins.fooUser.npmAuthToken,
            },
          });
          expect(listAfter).not.toContain(stageId);
        }),
      );
    });
  });
});
