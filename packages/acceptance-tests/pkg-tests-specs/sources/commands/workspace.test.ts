import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';

async function setupWorkspaces(path: PortablePath) {
  const docsFolder = `${path}/docs` as PortablePath;

  const componentAFolder = `${path}/components/component-a` as PortablePath;
  const componentBFolder = `${path}/components/component-b` as PortablePath;

  await xfs.mkdirPromise(docsFolder);

  await xfs.mkdirPromise(componentAFolder, {recursive: true});
  await xfs.mkdirPromise(componentBFolder, {recursive: true});

  await xfs.writeJsonPromise(ppath.join(docsFolder, Filename.manifest), {
    name: `docs`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Docs`,
    },
    dependencies: {
      [`component-a`]: `workspace:*`,
    },
  });

  await xfs.writeJsonPromise(ppath.join(componentAFolder, Filename.manifest), {
    name: `component-a`,
    version: `1.0.0`,
    scripts: {
      print: `echo Test Component A`,
      printInitCwd: `echo $INIT_CWD`,
    },
    dependencies: {
      [`component-b`]: `workspace:*`,
    },
  });

  await xfs.writeJsonPromise(ppath.join(componentBFolder, Filename.manifest), {
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
        },
      ),
    );

    test(
      `should run set INIT_CWD to each individual workspace cwd`,
      makeTemporaryEnv(
        {
          private: true,
          workspaces: [`docs`, `components/*`],
        },
        async ({path, run}) => {
          await setupWorkspaces(path);

          await run(`install`);

          await expect(run(`workspace`, `component-a`, `run`, `printInitCwd`, {cwd: ppath.join(path, `docs`)})).resolves.toMatchObject({
            stdout: `${npath.join(npath.fromPortablePath(path), `components/component-a`)}\n`,
          });
        },
      ),
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
            ({code, stdout, stderr} = await run(`workspace`, `component-a`, `print`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          await expect({code, stdout, stderr}).toMatchSnapshot();
        },
      ),
    );
  });
});
