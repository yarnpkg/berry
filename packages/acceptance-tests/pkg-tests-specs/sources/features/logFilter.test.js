import {xfs} from '@yarnpkg/fslib';

const makeCodeFilter = level => JSON.stringify([{
  code: `YN0005`,
  level,
}]);

const makeTextFilter = level => JSON.stringify([{
  text: `no-deps-scripted@npm:1.0.0 lists build scripts, but its build has been explicitly disabled through configuration.`,
  level,
}]);

const makePatternFilter = level => JSON.stringify([{
  pattern: `no-deps-scripted*`,
  level,
}]);

describe(`Features`, () => {
  describe(`LogFilters`, () => {
    test(`it should allow to filter by message name`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`);
      expect(stdout).toMatch(/lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makeCodeFilter(`discard`));

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);

      await run(`config`, `set`, `logFilters`, `--json`, makeCodeFilter(`info`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeCodeFilter(`warning`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeCodeFilter(`error`));

      let hadError = false;
      try {
        await run(`install`);
      } catch (err) {
        ({stdout} = err);
        hadError = true;
      }
      expect(hadError).toBe(true);
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);
    }));

    test(`it should allow to filter by message text`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`);
      expect(stdout).toMatch(/lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`discard`));

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`info`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`warning`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`error`));

      let hadError = false;
      try {
        await run(`install`);
      } catch (err) {
        ({stdout} = err);
        hadError = true;
      }
      expect(hadError).toBe(true);
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);
    }));

    test(`it should allow to filter by message text with colors enabled`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`, {env: {FORCE_COLOR: 1}});
      expect(stdout).toMatch(/lists build scripts/); // sanity check
      expect(stdout).not.toMatch(/no-deps-scripted@npm:1.0.0 lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`info`));

      ({stdout} = await run(`install`, {env: {FORCE_COLOR: 1}}));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeTextFilter(`discard`));

      ({stdout} = await run(`install`, {env: {FORCE_COLOR: 1}}));
      expect(stdout).not.toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);
    }));

    test(`it should allow to filter by pattern`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`);
      expect(stdout).toMatch(/lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makePatternFilter(`discard`));

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePatternFilter(`info`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePatternFilter(`warning`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePatternFilter(`error`));

      let hadError = false;
      try {
        await run(`install`);
      } catch (err) {
        ({stdout} = err);
        hadError = true;
      }
      expect(hadError).toBe(true);
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);
    }));

    test(`it should match any part of the log entry using patterns`, makeTemporaryEnv({
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/.yarnrc.yml`, `
        packageExtensions:
          'no-deps@*':
            peerDependencies:
              '@types/no-deps': '*'
      `);

      // sanity check
      await expect(run(`install`)).resolves.toMatchObject({
        code: 0,
        stdout: expect.stringContaining(`doesn't provide`),
      });

      await run(`config`, `set`, `logFilters`, `--json`, JSON.stringify([{
        pattern: `doesn't provide*`,
        level: `discard`,
      }]));

      await expect(run(`install`)).resolves.toMatchObject({
        code: 0,
        stdout: expect.not.stringContaining(`doesn't provide`),
      });
    }));
  });
});
