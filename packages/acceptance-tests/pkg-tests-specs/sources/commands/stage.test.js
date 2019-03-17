const {
  exec: {execFile},
  fs: {createTemporaryFolder, mkdirp, readJson, writeFile},
} = require('pkg-tests-core');

describe(`Commands`, () => {
  describe(`stage`, () => {
    test(
      `it should stage the initial files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - "${require.resolve(`@berry/monorepo/scripts/plugin-stage.js`)}"\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `${path}/.yarnrc\n${path}/package.json\n`,
        });
      }),
    );

    test(
      `it should not stage non-yarn files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await execFile(`git`, [`init`], {cwd: path});
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - "${require.resolve(`@berry/monorepo/scripts/plugin-stage.js`)}"\n`);

        await writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: `${path}/.yarnrc\n${path}/package.json\n`,
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
        await writeFile(`${path}/.yarnrc`, `plugins:\n  - "${require.resolve(`@berry/monorepo/scripts/plugin-stage.js`)}"\n`);

        await expect(run(`stage`, `-n`, {cwd: path})).resolves.toMatchObject({
          stdout: [
            `${path}/.pnp.js\n`,
            `${path}/.yarn/build-state.yml\n`,
            `${path}/.yarn/cache/.gitignore\n`,
            `${path}/.yarn/cache/no-deps-npm-1.0.0-7b98016e4791f26dcb7dcf593c5483002916726a04cbeec6eb2ab72d35ed3c1e.zip\n`,
            `${path}/.yarnrc\n`,
            `${path}/package.json\n`,
            `${path}/yarn.lock\n`,
          ].join(``),
        });
      }),
    );
  });
});
