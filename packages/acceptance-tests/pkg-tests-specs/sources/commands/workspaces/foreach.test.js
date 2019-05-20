const {
  fs: {writeJson, writeFile},
} = require('pkg-tests-core');

async function setupWorkspaces(path) {
  await writeFile(`${path}/mutexes/workspace-a`, ``);
  await writeFile(`${path}/mutexes/workspace-b`, ``);

  await writeFile(`${path}/.yarnrc`, `plugins:\n  - ${JSON.stringify(require.resolve(`@berry/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

  await writeFile(`${path}/packages/workspace-a/server.js`, getClientContent(`${path}/mutexes/workspace-a`, `PING`));
  await writeJson(`${path}/packages/workspace-a/package.json`, {
    name: `workspace-a`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace A`,
      start: `node server.js`,
    }
  });

  await writeFile(`${path}/packages/workspace-b/client.js`, getClientContent(`${path}/mutexes/workspace-b`, `PONG`));
  await writeJson(`${path}/packages/workspace-b/package.json`, {
    name: `workspace-b`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace B`,
      start: `node client.js`
    },
    dependencies: {
      [`workspace-a`]: `workspace:*`,
      [`workspace-c`]: `workspace:*`
    }
  });

  await writeJson(`${path}/packages/workspace-c/package.json`, {
    name: `workspace-c`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Workspace C`,
    },
    dependencies: {
      [`workspace-a`]: `workspace:*`
    }
  });
}

describe(`Commands`, () => {
  describe(`workspace foreach`, () => {
    test(
      `runs scripts in parallel with interlaced report`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `--parallel`, `--interlaced`, `--jobs=2`, `start`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          const lines = stdout.trim().split(`\n`);
          const firstLine = lines[0];

          let isInterlaced = false;

          // Expect Done on the last line
          expect(lines.pop()).toContain(`Done`);
          expect(lines.length).toBeGreaterThan(0);
          expect(code).toBe(0);
          expect(stderr).toBe(``);

          for (let i = 1; i < lines.length / 2; i++) {
            if (firstLine !== lines[i])
              isInterlaced = true;
          }

          expect(isInterlaced).toBe(true);
        }
      )
    );

    test(
      `runs scripts in parallel in topological order`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `--parallel`, `--with-dependencies`, `--jobs=2`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `runs scripts topological order by default`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `shows prefix with flag`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `--prefixed`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `run script only on included workspaces using [-i,--include]`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `--prefixed`, `--include`, `workspace-a`, `-i`, `workspace-b`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `excludes workspaces from running scripts using [-x,--exclude]`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspaces`, `foreach`, `run`, `--prefixed`, `--exclude`, `workspace-a`, `-x`, `workspace-b`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `throws an error if using jobs without parallel`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          await run(`install`);
          await expect(run(`workspaces`, `foreach`, `run`, `--jobs=2`, `print`)).rejects.toThrowError(/parallel must be set/);
        }
      )
    );

    test(
      `throws an error if jobs is lower than 2`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`packages/*`]
        },
        async ({ path, run }) => {
          await setupWorkspaces(path);

          await run(`install`);
          await expect(run(`workspaces`, `foreach`, `run`, `--parallel`, `--jobs=1`, `print`)).rejects.toThrowError(/jobs must be greater/);
        }
      )
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
