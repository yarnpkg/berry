const {npath, xfs} = require(`@yarnpkg/fslib`);
const {
  exec: {execFile},
  fs: {writeFile, writeJson, mkdirp},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`stage`, () => {
    test(
      `it should stage the initial files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-stage.js`))}\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${npath.fromPortablePath(`${path}/.yarnrc.yml`)}\n`,
            `${npath.fromPortablePath(`${path}/package.json`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should not stage non-yarn files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-stage.js`))}\n`);

        await writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${npath.fromPortablePath(`${path}/.yarnrc.yml`)}\n`,
            `${npath.fromPortablePath(`${path}/package.json`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should stage the cache folder`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-stage.js`))}\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${npath.fromPortablePath(`${path}/.pnp.js`)}\n`,
            `${npath.fromPortablePath(`${path}/.yarn/global/cache/no-deps-npm-1.0.0-cf533b267a-0.zip`)}\n`,
            `${npath.fromPortablePath(`${path}/.yarn/cache/.gitignore`)}\n`,
            `${npath.fromPortablePath(`${path}/.yarn/cache/no-deps-npm-1.0.0-cf533b267a-58e8c7e103.zip`)}\n`,
            `${npath.fromPortablePath(`${path}/.yarnrc.yml`)}\n`,
            `${npath.fromPortablePath(`${path}/package.json`)}\n`,
            `${npath.fromPortablePath(`${path}/yarn.lock`)}\n`,
          ].join(``),
        });
      }),
    );

    test(
      `it should commit with right messages`,
      makeTemporaryEnv({
        name: `my-commit-package`,
        dependencies: {
          [`deps1`]: `1.0.0`,
          [`deps2`]: `2.0.0`,
        },
      }, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc.yml`, `plugins:\n  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-stage.js`))}\n`);

        // Otherwise we can't always commit
        await execFile(`git`, [`config`, `user.name`, `John Doe`], {cwd: path});
        await execFile(`git`, [`config`, `user.email`, `john.doe@example.org`], {cwd: path});

        await mkdirp(`${path}/new-package`);
        await run(`${path}/new-package`, `init`);

        await expect(run(`stage`, `-c`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `chore(yarn): Creates my-commit-package (and one other)\n`,
        });

        await execFile(`git`, [`add`, `.`], {cwd: path});
        await execFile(`git`, [`commit`, `-m`, `wip`], {cwd: path});

        await xfs.removePromise(`${path}/new-package/package.json`);
        await writeJson(`${path}/package.json`, {
          name: `my-commit-package`,
          dependencies: {
            [`deps1`]: `2.0.0`,
            [`deps3`]: `2.0.0`,
          },
        });

        await expect(run(`stage`, `-c`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `chore(yarn): Deletes new-package, adds deps3, removes deps2, updates deps1 to 2.0.0\n`,
        });
      }),
    );
  });
});
