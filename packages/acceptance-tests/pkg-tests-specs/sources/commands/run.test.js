import {ppath, xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  for (const [description, args] of [[`with prefix`, [`run`]], [`without prefix`, []]]) {
    describe(`run ${description}`, () => {
      test(`it should run the selected script if available`, makeTemporaryEnv({
        scripts: {
          foo: `echo hello`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(...args, `foo`)).resolves.toMatchObject({
          stdout: `hello\n`,
        });
      }));

      test(`it should properly forward the script exit codes`, makeTemporaryEnv({
        scripts: {
          foo: `exit 42`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(...args, `foo`)).rejects.toMatchObject({
          code: 42,
        });
      }));

      test(`it should properly forward the script exit codes when calling into another yarnPath binary`, makeTemporaryEnv({
        scripts: {
          foo: `exit 0`,
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(ppath.join(path, `yarn-test-secondary-binary.js`), [
          `#!/usr/bin/env node`,
          `process.exit(42);`,
        ].join(`\n`));

        await run(`install`);

        await expect(run(...args, `foo`, {
          yarnPath: `./yarn-test-secondary-binary.js`,
        })).rejects.toMatchObject({
          code: 42,
        });
      }));
    });
  }

  describe(`run misc`, () => {
    test(
      `it should run the binaries from our dependencies if available`,
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
      `it should prefer scripts over binaries`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
          scripts: {
            [`has-bin-entries`]: `echo hello world`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entries`)).resolves.toMatchObject({
            stdout: `hello world\n`,
          });
        },
      ),
    );

    test(
      `it should ignore scripts when --binaries-only is set`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`has-bin-entries`]: `1.0.0`,
          },
          scripts: {
            [`has-bin-entries`]: `echo hello world`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `--binaries-only`, `has-bin-entries`, `success`)).resolves.toMatchObject({
            stdout: `success\n`,
          });
        },
      ),
    );

    test(
      `it shouldn't require the "--" flag to stop interpreting options after "run" commands (scripts)`,
      makeTemporaryEnv(
        {
          scripts: {
            [`hello`]: `echo`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `hello`, `--hello`)).resolves.toMatchObject({
            stdout: `--hello\n`,
          });
        },
      ),
    );

    test(
      `it shouldn't require the "--" flag to stop interpreting options after "run" commands (binaries)`,
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
    test(`it should print the list of available scripts if no parameters passed to command`,
      makeTemporaryEnv(
        {
          scripts: {
            foo: `echo hello`,
            bar: `echo hi`,
          },
        },
        async ({path, run, source}) => {
          const {code, stdout, stderr} = await run(`run`);
          expect({code, stdout, stderr}).toMatchSnapshot();
        },
      ),
    );

    test(`it should normalize scoped bin entries`,
      makeTemporaryEnv(
        {
          dependencies: {
            "@scoped/has-bin-entry": `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entry`)).resolves.toMatchObject({
            code: 0,
            stdout: `1.0.0\n`,
          });
        },
      ),
    );
  });
});
