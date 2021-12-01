const {
  exec: {execFile},
  fs: {writeJson, writeFile},
} = require(`pkg-tests-core`);

async function setupWorkspaces(path) {
  await writeFile(`${path}/mutexes/workspace-a`, ``);
  await writeFile(`${path}/mutexes/workspace-b`, ``);

  await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

  await writeFile(`${path}/packages/workspace-a/server.js`, getClientContent(`${path}/mutexes/workspace-a`, `PING`));
  await writeJson(`${path}/packages/workspace-a/package.json`, {
    name: `workspace-a`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace A`,
      start: `node server.js`,
      testExit: `exit 0`,
    },
  });

  await writeFile(`${path}/packages/workspace-b/client.js`, getClientContent(`${path}/mutexes/workspace-b`, `PONG`));
  await writeJson(`${path}/packages/workspace-b/package.json`, {
    name: `workspace-b`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace B`,
      start: `node client.js`,
      testExit: `exit 1`,
    },
    dependencies: {
      [`workspace-a`]: `workspace:*`,
      [`workspace-c`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/package.json`, {
    name: `workspace-c`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace C`,
    },
    workspaces: [`packages/*`],
    dependencies: {
      [`workspace-a`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-d/package.json`, {
    name: `workspace-d`,
    version: `1.0.0`,
    workspaces: [`packages/*`],
    scripts: {
      print: `echo Test Workspace D`,
    },
    dependencies: {
      [`workspace-b`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-d/packages/workspace-e/package.json`, {
    name: `workspace-e`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace E`,
    },
    dependencies: {
      [`workspace-d`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-f/package.json`, {
    name: `workspace-f`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace F`,
    },
    dependencies: {
      [`workspace-e`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/packages/workspace-c/packages/workspace-g/package.json`, {
    name: `workspace-g`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace G`,
      'g:echo': `echo Test Workspace G`,
    },
    dependencies: {},
  });
}

describe(`Commands`, () => {
  describe(`workspace foreach`, () => {
    test(
      `should run on current and descendant workspaces by default`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `run`, `print`, {cwd: `${path}/packages/workspace-c`})).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should execute 'node' command`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          const {code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--topological`, `node`, `-p`, `require("./package.json").name`, {cwd: `${path}/packages/workspace-c`});

          const orderedStdout = stdout.trim().split(`\n`);
          expect(orderedStdout.pop()).toContain(`Done`);

          // The exact order is unstable, so just make sure all the workspaces we expect to be there, are.
          orderedStdout.sort();

          await expect({code, orderedStdout, stderr}).toMatchSnapshot();
        },
      ),
    );

    test(
      `should run scripts in parallel and interlace the output when run with --parallel --interlaced`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          const {code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--interlaced`, `--jobs`, `2`, `run`, `start`);

          const lines = stdout.trim().split(`\n`);
          const firstLine = lines[0];

          let isInterlaced = false;

          // Expect Done on the last line
          expect(lines.pop()).toContain(`Done`);
          expect(lines.length).toBeGreaterThan(0);
          expect(code).toBe(0);
          expect(stderr).toBe(``);

          for (let i = 1; i < lines.length / 2; i++)
            if (firstLine !== lines[i])
              isInterlaced = true;

          expect(isInterlaced).toBe(true);
        },
      ),
    );

    test(
      `should run scripts in parallel but following the topological order when run with --parallel --topological`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          const {code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--topological`, `--jobs`, `2`, `run`, `print`);

          const extractWorkspaces = output => {
            const relevantOutput = output.split(`\n`).filter(output => output.includes(`Test Workspace`));
            return relevantOutput.map(output => output.match(/Workspace (?<name>\w+)/).groups.name);
          };

          const order = extractWorkspaces(stdout);

          // A and G have the same precedence
          expect([order[0], order[1]]).toEqual(expect.arrayContaining([`A`, `G`]));

          expect(order.slice(2)).toMatchSnapshot();

          await expect({code, stderr}).toMatchSnapshot();
        },
      ),
    );

    test(
      `should prefix the output with run with --verbose`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--verbose`, `run`, `print`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should only run the scripts on workspaces that match the --include list`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--verbose`, `--include`, `workspace-a`, `--include`, `workspace-b`, `run`, `print`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should never run the scripts on workspaces that match the --exclude list`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--verbose`, `--exclude`, `workspace-a`, `--exclude`, `workspace-b`, `run`, `print`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should not fall into endless loop if foreach cmd is the same as lifecycle script name`,
      makeTemporaryEnv(
        {
          private: true,
          scripts: {
            print: `yarn workspaces foreach --all run print`,
          },
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`print`)).resolves.toMatchSnapshot();
        },
      ),
    );

    // Clipanion doesn't support this yet
    test.skip(
      `should throw an error when using --jobs without --parallel`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--jobs`, `2`, `run`, `print`)).rejects.toThrowError(/parallel must be set/);
        },
      ),
    );

    test(
      `should throw an error when using --jobs with a value lower than 1`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--parallel`, `--jobs`, `0`, `run`, `print`)).rejects.toThrowError(/to be at least 1 \(got 0\)/);
        },
      ),
    );

    test(
      `should start all the processes at once when --jobs is unlimited`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          const {code, stdout, stderr} = await run(`workspaces`, `foreach`, `--parallel`, `--jobs`, `unlimited`, `--verbose`, `run`, `print`);

          // We don't care what order they start in, just that they all started at the beginning.
          const first7Lines = stdout.split(`\n`).slice(0, 7).sort().join(`\n`);

          await expect({code, first7Lines, stderr}).toMatchSnapshot();
        },
      ),
    );

    test(`can run on public workspaces only`, makeTemporaryEnv(
      {
        private: true,
        workspaces: [`packages/*`],
      },
      async ({path, run}) => {
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

        await writeJson(`${path}/packages/package-a/package.json`, {
          name: `workspace-a`,
          version: `1.0.0`,
          scripts: {
            print: `echo Test Workspace A`,
          },
        });

        await writeJson(`${path}/packages/package-b/package.json`, {
          name: `workspace-b`,
          version: `1.0.0`,
          private: true,
          scripts: {
            print: `echo Test Workspace B`,
          },
        });

        await writeJson(`${path}/packages/package-c/package.json`, {
          name: `workspace-c`,
          version: `1.0.0`,
          private: false,
          scripts: {
            print: `echo Test Workspace C`,
          },
        });

        await run(`install`);

        await expect(run(`workspaces`, `foreach`, `--no-private`, `run`, `print`)).resolves.toMatchSnapshot();
      },
    ));

    test(
      `should return correct exit code when encountered errors in running scripts`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);

          let code = 0;
          try {
            await run(`install`);
            await run(`workspaces`, `foreach`, `run`, `testExit`);
          } catch (error) {
            ({code} = error);
          }

          expect(code).toBe(1);
        },
      ),
    );

    test(
      `should run execute global scripts even on workspaces that don't declare them`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
          scripts: {
            [`test:colon`]: `echo One execution`,
          },
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--topological`, `run`, `test:colon`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should run set INIT_CWD to each individual workspace cwd even with global scripts`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
          scripts: {
            [`test:foo`]: `yarn workspaces foreach run test:bar`,
            [`test:bar`]: `node -p 'require("path").relative(process.cwd(), process.argv[1]).replace(/\\\\/g, "/")' "$INIT_CWD"`,
          },
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`test:foo`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should handle global scripts getting downgraded to a normal script`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
          scripts: {
            [`g:echo`]: `echo root workspace`,
          },
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--topological`, `run`, `g:echo`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should include dependencies if using --recursive`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--recursive`, `--topological`, `run`, `print`, {cwd: `${path}/packages/workspace-b`})).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `should include dependencies of workspaces matching the from filter if using --from and --recursive`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `--recursive`, `--topological`, `--from`, `{workspace-a,workspace-b,workspace-g}`, `run`, `print`, {cwd: path})).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `--since runs on no workspaces if there have been no changes`,
      makeWorkspacesForeachSinceEnv(async ({run}) => {
        await expect(run(`workspaces`, `foreach`, `--since`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `--since runs only on changed workspaces`,
      makeWorkspacesForeachSinceEnv(async ({path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await expect(run(`workspaces`, `foreach`, `--since`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `--since runs on no workspaces if there are no staged or unstaged changes on the default branch`,
      makeWorkspacesForeachSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);

        await expect(run(`workspaces`, `foreach`, `--since`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `--since runs on workspaces changed since commit`,
      makeWorkspacesForeachSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);

        const ref = (await git(`rev-parse`, `HEAD`)).stdout.trim();

        await writeJson(`${path}/packages/workspace-b/delta.json`, {});
        await writeJson(`${path}/packages/workspace-c/delta.json`, {});

        await expect(run(`workspaces`, `foreach`, `--since=${ref}`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `--since runs on workspaces changed since branching from the default branch`,
      makeWorkspacesForeachSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await git(`add`, `.`);
        await git(`commit`, `-m`, `wip`);
        await git(`checkout`, `-b`, `feature`);

        await writeJson(`${path}/packages/workspace-b/delta.json`, {});
        await writeJson(`${path}/packages/workspace-c/delta.json`, {});

        await expect(run(`workspaces`, `foreach`, `--since`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `--since --recursive runs on workspaces changed and their dependents`,
      makeWorkspacesForeachSinceEnv(async ({git, path, run}) => {
        await writeJson(`${path}/packages/workspace-a/delta.json`, {});

        await expect(run(`workspaces`, `foreach`, `--since`, `--recursive`, `run`, `print`)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `it should run on workspaces with matching binaries`,
      makeTemporaryEnv(
        {
          dependencies: {
            'has-bin-entries': `1.0.0`,
          },
        },
        {
          plugins: [
            require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`),
          ],
        },
        async ({run}) => {
          await run(`install`);

          await expect(run(`workspaces`, `foreach`, `run`, `has-bin-entries`, `binary-executed`)).resolves.toMatchObject({
            code: 0,
            stdout: expect.stringContaining(`binary-executed`),
          });
        },
      ),
    );
  });
});

function getClientContent(mutex, name) {
  return `
    const fs = require('fs');
    const path = require('path');

    const mutex = ${JSON.stringify(mutex)};
    const mutexDir = path.dirname(mutex);

    async function handshake() {
      fs.unlinkSync(mutex);

      while (fs.readdirSync(mutexDir).length !== 0) {
        await sleep();
      }
    }

    async function sleep() {
      await new Promise(resolve => {
        setTimeout(resolve, 16);
      });
    }

    async function main() {
      await handshake();

      for (let t = 0; t < 60; ++t) {
        process.stdout.write(${JSON.stringify(name)} + '\\n');
        await sleep();
      }
    }

    main();
  `;
}

function makeWorkspacesForeachSinceEnv(cb) {
  return makeTemporaryEnv({
    private: true,
    workspaces: [`packages/*`],
  }, {
    plugins: [
      require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`),
    ],
  }, async ({path, run, ...rest}) => {
    await setupWorkspaces(path);

    const git = (...args) => execFile(`git`, args, {cwd: path});

    await run(`install`);

    await git(`init`, `.`);

    // Otherwise we can't always commit
    await git(`config`, `user.name`, `John Doe`);
    await git(`config`, `user.email`, `john.doe@example.org`);
    await git(`config`, `commit.gpgSign`, `false`);

    await git(`add`, `.`);
    await git(`commit`, `-m`, `First commit`);

    await cb({path, run, ...rest, git});
  });
}
