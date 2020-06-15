const {
  fs: {writeFile, writeJson},
} = require(`pkg-tests-core`);


async function setupWorkspaces(path) {
  await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-workspace-tools.js`))}\n`);

  await writeJson(`${path}/docs/package.json`, {
    name: `docs`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Docs`,
    },
    dependencies: {
      [`component-a`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/components/component-a/package.json`, {
    name: `component-a`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Component A`,
    },
    dependencies: {
      [`component-b`]: `workspace:*`,
    },
  });

  await writeJson(`${path}/components/component-b/package.json`, {
    name: `component-b`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Component B`,
    },
  });
}

describe(`Commands`, () => {
  describe(`workspace <workspace-name> <sub-command>`, () => {
    test(
      `runs a given command in the specified workspace`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`docs`, `components/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspace`, `component-a`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );

    test(
      `when the given workspace doesnt exist lists all possible workspaces`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`docs`, `components/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);

          let code;
          let stdout;
          let stderr;

          try {
            await run(`install`);
            ({code, stdout, stderr} = await run(`workspace`, `compoment-a`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        }
      )
    );
  });
});
