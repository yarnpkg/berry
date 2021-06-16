const makeCodeFilter = level => JSON.stringify([{
  code: `YN0005`,
  level,
}]);

const makeTextFilter = level => JSON.stringify([{
  text: `no-deps-scripted@npm:1.0.0 lists build scripts, but its build has been explicitly disabled through configuration.`,
  level,
}]);

const makePartialTextFilter = level => JSON.stringify([{
  text: `no-deps-scripted@npm:1.0.0`,
  level,
}]);

const makeRegExpFilter = level => JSON.stringify([{
  text: `no-.*-scripted`,
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

    test(`it should allow to filter with a partial message text`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`);
      expect(stdout).toMatch(/lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makePartialTextFilter(`discard`));

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePartialTextFilter(`info`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePartialTextFilter(`warning`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makePartialTextFilter(`error`));

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

    test(`it should allow to filter with a regular expression`, makeTemporaryEnv({
      dependencies: {
        [`no-deps-scripted`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps-scripted`]: {built: false},
      },
    }, async ({path, run, source}) => {
      let {stdout} = await run(`install`);
      expect(stdout).toMatch(/lists build scripts/); // sanity check

      await run(`config`, `set`, `logFilters`, `--json`, makeRegExpFilter(`discard`));

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeRegExpFilter(`info`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeRegExpFilter(`warning`));

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilters`, `--json`, makeRegExpFilter(`error`));

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
  });
});
