/* @flow */

import type {PackageDriver} from 'pkg-tests-core';

const {existsSync, mkdirp} = require('fs-extra');
const {isAbsolute, resolve} = require('path');

const {
  fs: {createTemporaryFolder, makeFakeBinary},
} = require(`pkg-tests-core`);

const globalName = makeTemporaryEnv.getPackageManagerName();

describe(`Scripts tests`, () => {
  test(
    `it should run scripts using the same Node than the one used by Yarn`,
    makeTemporaryEnv({scripts: {myScript: `node --version`}}, async ({path, run, source}) => {
      await run(`install`);

      await makeFakeBinary(`${path}/bin/node`, {exitCode: 0});

      await expect(run(`run`, `myScript`)).resolves.not.toMatchObject({stdout: `Fake binary`});
    }),
  );

  test(
    `it should run scripts using the same package manager than the one running the scripts`,
    makeTemporaryEnv({scripts: {myScript: `${globalName} --version`}}, async ({path, run, source}) => {
      await run(`install`);

      await makeFakeBinary(`${path}/bin/${globalName}`, {exitCode: 0});

      await expect(run(`run`, `myScript`)).resolves.not.toMatchObject({stdout: `Fake binary`});
    }),
  );

  test(
    `it should run declared scripts`,
    makeTemporaryEnv(
      {
        scripts: {
          [`foobar`]: `echo test successful`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`run`, `foobar`)).resolves.toMatchObject({
          stdout: `test successful\n`,
        });
      },
    ),
  );

  test(
    `it should allow to execute the dependencies binaries`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`run`, `has-bin-entries`, `success`)).resolves.toMatchObject({
          stdout: `success\n`,
        });
      },
    ),
  );

  test(
    `it should allow to execute the dependencies binaries even from a different cwd than the project root`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await mkdirp(`${path}/foo/bar`);

        await expect(
          run(`run`, `has-bin-entries`, `success`, {
            cwd: `${path}/foo/bar`,
          }),
        ).resolves.toMatchObject({
          stdout: `success\n`,
        });
      },
    ),
  );

  test(
    `it should allow to retrieve the path to a dependency binary by its name`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`bin`, `has-bin-entries`);

        expect(stdout.trim()).not.toEqual(``);
        await expect(
          source(`require('fs').existsSync(${JSON.stringify(resolve(path, stdout.trim()))})`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it should return an absolute path when retrieving the path to a dependency binary`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`bin`, `has-bin-entries`);

        expect(isAbsolute(stdout.trim())).toEqual(true);
      },
    ),
  );

  test(
    `it should allow to retrieve the path to a dependency binary, even when running from outside the project`,
    makeTemporaryEnv(
      {
        dependencies: {[`has-bin-entries`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);

        const tmp = await createTemporaryFolder();

        const {stdout} = await run(`bin`, `has-bin-entries`, {
          projectFolder: path,
          cwd: tmp,
        });

        expect(stdout.trim()).not.toEqual(``);
        await expect(
          source(`require('fs').existsSync(${JSON.stringify(resolve(path, stdout.trim()))})`),
        ).resolves.toEqual(true);
      },
    ),
  );

  test(
    `it shouldn't require the "--" flag to stop interpreting options after "run" commands`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`run`, `has-bin-entries`, `--hello`)).resolves.toMatchObject({
          stdout: `--hello\n`,
        });
      },
    ),
  );

  test(
    `it should allow dependency binaries to require their own dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`run`, `has-bin-entries-with-require`)).resolves.toMatchObject({
          stdout: `no-deps\n1.0.0\n`,
        });
      },
    ),
  );

  test(
    `it should allow dependency binaries to require relative paths`,
    makeTemporaryEnv({dependencies: {[`has-bin-entries`]: `1.0.0`}}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`run`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
        stdout: `42\n`,
      });
    }),
  );

  test(
    `it should run install scripts during the install`,
    makeTemporaryEnv({dependencies: {[`no-deps-scripted`]: `1.0.0`}}, async ({path, run, source}) => {
      await run(`install`);

      await expect(source(`require('no-deps-scripted/log.js')`)).resolves.toEqual([
        'preinstall',
        'install',
        'postinstall',
      ]);
    }),
  );

  test(
    `it should allow dependencies with install scripts to run the binaries exposed by their own dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {[`one-dep-scripted`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await run(`install`);
      },
    ),
  );
});
