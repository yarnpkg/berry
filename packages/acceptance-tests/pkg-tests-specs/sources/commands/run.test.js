describe(`Commands`, () => {
  for (const [description, args] of [[`with prefix`, [`run`]], [`without prefix`, []]]) {
    describe(`run ${description}`, () => {
      test(`it should run the selected script if available`, makeTemporaryEnv({
        scripts: {
          foo: `echo hello`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(... args, `foo`)).resolves.toMatchObject({
          stdout: `hello\n`,
        });
      }));

      test(`it should properly forward the script exit codes`, makeTemporaryEnv({
        scripts: {
          foo: `exit 42`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(... args, `foo`)).rejects.toMatchObject({
          code: 42,
        });
      }));

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
    });
  }
});
