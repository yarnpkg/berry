import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {tests}                from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`npm audit`, () => {
    test(
      `it should return vulnerable packages`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`npm`, `audit`, `--json`)).rejects.toThrow(/"https:\/\/example\.com\/advisories\/1"/);
      }),
    );

    test(
      `it should return vulnerable virtual packages`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable-peer-deps`]: `1.0.0`,
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`npm`, `audit`, `--json`)).rejects.toThrow(/"https:\/\/example\.com\/advisories\/2"/);
      }),
    );

    test(
      `it should also audit development packages by default`,
      makeTemporaryEnv({
        devDependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`npm`, `audit`, `--json`)).rejects.toThrow(/"https:\/\/example\.com\/advisories\/1"/);
      }),
    );

    test(
      `it should also audit only production packages if requested`,
      makeTemporaryEnv({
        devDependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`, `--environment=production`);
      }),
    );

    test(
      `it should also audit only development packages if requested`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`, `--environment=development`);
      }),
    );

    test(
      `it shouldn't return vulnerable packages if the current version isn't affected`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable`]: `1.1.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`);
      }),
    );

    test(
      `it shouldn't detect transitive vulnerable packages by default`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`);
      }),
    );

    test(
      `it should detect transitive vulnerable packages when requested`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`npm`, `audit`, `-R`, `--json`)).rejects.toThrow(/"https:\/\/example\.com\/advisories\/1"/);
      }),
    );

    test(
      `it should follow link:-protocol dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`foo`]: `portal:./foo`,
        },
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `foo`));

        await xfs.writeJsonPromise(ppath.join(path, `foo`, Filename.manifest), {
          dependencies: {
            [`vulnerable`]: `1.0.0`,
          },
        });

        await run(`install`);

        await expect(run(`npm`, `audit`, `-R`, `--json`)).rejects.toThrow(/"https:\/\/example\.com\/advisories\/1"/);
      }),
    );

    test(
      `it should allow excluding packages`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`, `--exclude`, `vulnerable`);
      }),
    );

    test(
      `it should allow ignoring advisories`,
      makeTemporaryEnv({
        dependencies: {
          [`vulnerable`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`npm`, `audit`, `--ignore`, `1`);
      }),
    );
  });
});
