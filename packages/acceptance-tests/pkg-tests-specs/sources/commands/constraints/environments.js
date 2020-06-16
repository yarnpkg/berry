const {
  fs: {mkdirp, writeJson},
} = require(`pkg-tests-core`);

exports.environments = {
  [`empty project`]: async path => {
    await writeJson(`${path}/package.json`, {});
  },
  [`one regular dependency`]: async path => {
    await writeJson(`${path}/package.json`, {
      dependencies: {
        [`no-deps`]: `1.0.0`,
      },
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
      name: `workspace-a`,
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
      name: `workspace-b`,
      dependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
      devDependencies: {
        [`no-deps`]: `1.0.0`,
        [`no-deps-bin`]: `1.0.0`,
      },
      dependenciesMeta: {
        [`no-deps`]: {
          built: false,
        },
      },
    });
  },
};
