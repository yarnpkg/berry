const ONE_DAY_IN_MINUTES = 24 * 60;

describe(`Features`, () => {
  describe(`npmMinimalAgeGate and npmPreapprovedPackages`, () => {
    describe(`add`, () => {
      test(
        `add should install the latest version allowed by the minimum release age`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run, source}) => {
          await run(`add`, `release-date`);
          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.0`,
          });
        }),
      );

      test(
        `it should fail when trying to install exact version that is newer than the minimum release age`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run}) => {
          await expect(run(`add`, `release-date@1.1.1`)).rejects.toThrowError(`No candidates found`);
        }),
      );

      test(
        `it should install older package versions when the minimum release age disallows the newest suitable version`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.0`,
          });
        }),
      );

      test(
        `it should install new version when excluded by exact locator; while transitive dependencies are not excluded`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@1.1.1`],
          // we are checking a transitive dependencies version, which the pnp will throw an error for
          // disabling these checks for the purpose of this test
          pnpFallbackMode: `all`,
          pnpMode: `loose`,
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });

          await expect(source(`require('release-date-transitive/package.json')`)).resolves.toMatchObject({
            name: `release-date-transitive`,
            version: `1.1.0`,
          });
        }),
      );

      test(
        `it should install new version when excluded by npm protocol locator`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@npm:1.1.1`],
        }, async ({run, source}) => {
          await run(`add`, `release-date@1.1.1`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by descriptor range`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@^1.0.0`],
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by npm protocol descriptor range`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@npm:^1.0.0`],
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by package name glob pattern`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-*`],
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by package ident`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date`],
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should not impact semver prioritization of newer versions when multiple versions meet the age requirement`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: 0,
        }, async ({run, source}) => {
          await run(`add`, `release-date@^1.0.0`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should work with scoped packages`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run}) => {
          await expect(run(`add`, `@scoped/release-date@1.1.1`)).rejects.toThrowError(`No candidates found`);
        }),
      );

      test(
        `it should install scoped package when excluded`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`@scoped/release-date`],
        }, async ({run, source}) => {
          await run(`add`, `@scoped/release-date@^1.0.0`);

          await expect(source(`require('@scoped/release-date/package.json')`)).resolves.toMatchObject({
            name: `@scoped/release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install scoped package when excluded by scoped glob pattern`,
        makeTemporaryEnv({}, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`@scoped/*`],
        }, async ({run, source}) => {
          await run(`add`, `@scoped/release-date@^1.0.0`);

          await expect(source(`require('@scoped/release-date/package.json')`)).resolves.toMatchObject({
            name: `@scoped/release-date`,
            version: `1.1.1`,
          });
        }),
      );
    });
    describe(`install`, () => {
      test(
        `it should fail when trying to install exact version that is too new`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `1.1.1`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run}) => {
          await expect(run(`install`)).rejects.toThrowError(`No candidates found`);
        }),
      );

      test(
        `it should install older package versions when the minimum release age disallows the newest suitable version`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.0`,
          });
        }),
      );

      test(
        `it should install new version when excluded by exact locator`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@1.1.1`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by npm protocol locator`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `1.1.1`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@npm:1.1.1`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by descriptor range`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@^1.0.0`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by npm protocol descriptor range`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date@npm:^1.0.0`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by package name glob pattern`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-*`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install new version when excluded by package ident`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`release-date`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should not impact semver prioritization of newer versions when multiple versions meet the age requirement`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: 0,
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should work with scoped packages`,
        makeTemporaryEnv({
          dependencies: {[`@scoped/release-date`]: `1.1.1`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run}) => {
          await expect(run(`install`)).rejects.toThrowError(`No candidates found`);
        }),
      );

      test(
        `it should install scoped package when excluded`,
        makeTemporaryEnv({
          dependencies: {[`@scoped/release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`@scoped/release-date`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('@scoped/release-date/package.json')`)).resolves.toMatchObject({
            name: `@scoped/release-date`,
            version: `1.1.1`,
          });
        }),
      );

      test(
        `it should install scoped package when excluded by scoped glob pattern`,
        makeTemporaryEnv({
          dependencies: {[`@scoped/release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
          npmPreapprovedPackages: [`@scoped/*`],
        }, async ({run, source}) => {
          await run(`install`);

          await expect(source(`require('@scoped/release-date/package.json')`)).resolves.toMatchObject({
            name: `@scoped/release-date`,
            version: `1.1.1`,
          });
        }),
      );
    });
    describe(`up`, () => {
      test(
        `it should update to the latest version allowed by the minimum release age`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run, source}) => {
          await run(`install`);
          await run(`set`, `resolution`, `release-date@npm:^1.0.0`, `npm:1.0.0`);

          const preUpVersion = (await source(`require('release-date/package.json')`)).version;
          if (preUpVersion !== `1.0.0`)
            throw new Error(`Pre-up version is not 1.0.0`);

          await run(`up`, `release-date`);
          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.0`,
          });
        }),
      );
      test(
        `recursive should update to the latest version allowed by the minimum release age`,
        makeTemporaryEnv({
          dependencies: {[`release-date`]: `^1.0.0`},
        }, {
          // we are checking a transitive dependencies version, which the pnp will throw an error for
          // disabling these checks for the purpose of this test
          pnpFallbackMode: `all`,
          pnpMode: `loose`,
          npmMinimalAgeGate: ONE_DAY_IN_MINUTES,
        }, async ({run, source}) => {
          await run(`install`);
          await run(`set`, `resolution`, `release-date@npm:^1.0.0`, `npm:1.0.0`);
          await run(`set`, `resolution`, `release-date-transitive@npm:^1.0.0`, `npm:1.0.0`);

          const preUpVersion = (await source(`require('release-date/package.json')`)).version;
          const preUpVersionTransitive = (await source(`require('release-date/package.json')`)).version;
          if (preUpVersion !== `1.0.0` || preUpVersionTransitive !== `1.0.0`)
            throw new Error(`Pre-up version is not 1.0.0`);

          await run(`up`, `-R`, `*`);
          await expect(source(`require('release-date/package.json')`)).resolves.toMatchObject({
            name: `release-date`,
            version: `1.1.0`,
          });
          await expect(source(`require('release-date-transitive/package.json')`)).resolves.toMatchObject({
            name: `release-date-transitive`,
            version: `1.1.0`,
          });
        }),
      );
    });
  });
});
