import {PortablePath, ppath, xfs} from '@yarnpkg/fslib';

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
      `it shouldn't print info for the transitive dependencies by default`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`info`, `no-deps`, `--json`)).rejects.toThrow();
      }),
    );

    test(
      `it should print info for the transitive dependencies if -R,--recursive is set`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`info`, `no-deps`, `--recursive`, `--json`);
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
      `it shouldn't print info for other workspaces by default`,
      makeTemporaryEnv({
        workspaces: [
          `workspace`,
        ],
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `workspace` as PortablePath));
        await xfs.writeJsonPromise(ppath.join(path, `workspace/package.json` as PortablePath), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await run(`install`);

        await expect(run(`info`, `no-deps`, `--json`)).rejects.toThrow();
      }),
    );

    test(
      `it should print info for other workspaces if -A,--all is set`,
      makeTemporaryEnv({
        workspaces: [
          `workspace`,
        ],
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(ppath.join(path, `workspace` as PortablePath));
        await xfs.writeJsonPromise(ppath.join(path, `workspace/package.json` as PortablePath), {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await run(`install`);

        const {stdout} = await run(`info`, `no-deps`, `--all`, `--json`);
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

        const {stdout} = await run(`info`, `no-deps`, `--recursive`, `--json`);
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

        const {stdout} = await run(`info`, `no-deps@npm:2.0.0`, `--recursive`, `--json`);
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

        const {stdout} = await run(`info`, `no-*`, `--recursive`, `--json`);
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

        const {stdout} = await run(`info`, `*@npm:2.0.0`, `--recursive`, `--json`);
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
