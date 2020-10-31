describe(`Features`, () => {
  describe(`LogFilter`, () => {
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

      await run(`config`, `set`, `logFilter.YN0005`, `discard`);

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);

      await run(`config`, `set`, `logFilter.YN0005`, `info`);

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilter.YN0005`, `warning`);

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilter.YN0005`, `error`);

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

      await run(`config`, `set`, `logFilter["lists build scripts"]`, `discard`);

      ({stdout} = await run(`install`));
      expect(stdout).not.toMatch(/lists build scripts/);

      await run(`config`, `set`, `logFilter["lists build scripts"]`, `info`);

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).not.toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilter["lists build scripts"]`, `warning`);

      ({stdout} = await run(`install`));
      expect(stdout).toMatch(/lists build scripts/);
      expect(stdout).not.toMatch(/Failed with errors/);
      expect(stdout).toMatch(/Done with warnings/);

      await run(`config`, `set`, `logFilter["lists build scripts"]`, `error`);

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
