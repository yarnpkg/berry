const {
  fs: {createTemporaryFolder, mkdirp, writeFile, writeJson},
} = require('pkg-tests-core');

const environments = {
  [`empty project`]: async path => {
    await writeJson(`${path}/package.json`, {});
  },
  [`one regular dependency`]: async path => {
    await writeJson(`${path}/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
      }
    });
  },
  [`two regular dependencies`]: async path => {
    await writeJson(`${path}/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
    });
  },
  [`two development dependencies`]: async path => {
    await writeJson(`${path}/package.json`, {
      devDependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
    });
  },
  [`two regular dependencies, two development dependencies`]: async path => {
    await writeJson(`${path}/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
      devDependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
    });
  },
  [`multiple workspaces`]: async path => {
    await writeJson(`${path}/package.json`, {
      private: true,
      workspaces: [`packages/**`],
    });

    await mkdirp(`${path}/packages/workspace-a`);
    await mkdirp(`${path}/packages/workspace-b`);

    await writeJson(`${path}/packages/workspace-a/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
      devDependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
    });

    await writeJson(`${path}/packages/workspace-b/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
      devDependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
    });
  },
};

const constraints = {
  [`empty constraints`]: ``,
  [`gen_enforced_dependency_range (missing)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'one-fixed-dep', '1.0.0', peerDependencies).`,
  [`gen_enforced_dependency_range (incompatible)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'no-deps', '2.0.0', dependencies).`,
  [`gen_enforced_dependency_range (extraneous)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'no-deps', null, _).`,
};

describe(`Commands`, () => {
  describe(`constraints check`, () => {
    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [scriptDescription, script] of Object.entries(constraints)) {
        // Note: Don't use concurrent testing w/ snapshots, they don't work together
        test(`test (${environmentDescription} / ${scriptDescription})`, makeTemporaryEnv({}, async ({path, run, source}) => {
          await environment(path);
          await writeFile(`${path}/constraints.pro`, script);

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`constraints`, `check`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
