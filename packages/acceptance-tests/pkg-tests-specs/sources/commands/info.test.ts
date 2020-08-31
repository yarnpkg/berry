// We need this to silence the TS warning about isolatedModule, since there's no import
// eslint-disable-next-line
export default null;

describe(`Commands`, () => {
  describe(`info`, () => {
    test(
      `it should print info for the specified package`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `no-deps`, `--json`);
        const data = stdout.match(/.*\n/g)!.map(line => JSON.parse(line));

        expect(data).toHaveLength(1);

        expect(data[0]).toMatchObject({
          value: `no-deps@npm:1.0.0`,
          children: {
            Version: `1.0.0`,
          },
        });
      }),
    );

    test(
      `it should throw an error if the package is nowhere to be found`,
      makeTemporaryEnv({
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`info`, `no-deps`, `--json`)).rejects.toThrow();
      }),
    );

    test(
      `it should print info for all the matching packages`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `no-deps`, `--json`);
        const data = stdout.match(/.*\n/g)!.map(line => JSON.parse(line));

        expect(data).toHaveLength(2);

        expect(data[0]).toMatchObject({
          value: `no-deps@npm:1.0.0`,
          children: {
            Version: `1.0.0`,
          },
        });

        expect(data[1]).toMatchObject({
          value: `no-deps@npm:2.0.0`,
          children: {
            Version: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should allow filtering packages by reference`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `no-deps@npm:2.0.0`, `--json`);
        const data = stdout.match(/.*\n/g)!.map(line => JSON.parse(line));

        expect(data).toHaveLength(1);

        expect(data[0]).toMatchObject({
          value: `no-deps@npm:2.0.0`,
          children: {
            Version: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should allow filtering packages by glob idents`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `no-*`, `--json`);
        const data = stdout.match(/.*\n/g)!.map(line => JSON.parse(line));

        expect(data).toHaveLength(2);

        expect(data[0]).toMatchObject({
          value: `no-deps@npm:1.0.0`,
          children: {
            Version: `1.0.0`,
          },
        });

        expect(data[1]).toMatchObject({
          value: `no-deps@npm:2.0.0`,
          children: {
            Version: `2.0.0`,
          },
        });
      }),
    );

    test(
      `it should allow filtering packages by both glob ident and reference`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`one-fixed-dep`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `*@npm:2.0.0`, `--json`);
        const data = stdout.match(/.*\n/g)!.map(line => JSON.parse(line));

        expect(data).toHaveLength(2);

        expect(data[0]).toMatchObject({
          value: `no-deps@npm:2.0.0`,
          children: {
            Version: `2.0.0`,
          },
        });

        expect(data[1]).toMatchObject({
          value: `one-fixed-dep@npm:2.0.0`,
          children: {
            Version: `2.0.0`,
          },
        });
      }),
    );
  });
});
