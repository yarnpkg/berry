import {fs as fsUtils} from 'pkg-tests-core';

describe(`Commands`, () => {
  describe(`pack`, () => {
    test(
      `it should list all the files in a package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/index\.js/);
      }),
    );

    test(
      `it should only keep the files covered by the "files" field`,
      makeTemporaryEnv({
        files: [
          `*.js`,
          `/b.ts`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/b.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/a.ts`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/b.ts`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/a\.js/);
        await expect(stdout).toMatch(/b\.js/);
        await expect(stdout).not.toMatch(/a\.ts/);
        await expect(stdout).toMatch(/b\.ts/);
      }),
    );

    test(
      `it shouldn't add .gitignore files to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/.gitignore`, ``);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/\.gitignore/);
      }),
    );

    test(
      `it shouldn't add .npmignore files to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/.npmignore`, ``);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/\.npmignore/);
      }),
    );

    test(
      `it shouldn't add the cache to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/\.yarn\/cache/);
      }),
    );

    test(
      `it shouldn't add the lockfile to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/yarn\.lock/);
      }),
    );

    test(
      `it should ignore the files covered by the local gitignore file`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.gitignore`, `/index.js\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/index\.js/);
      }),
    );

    test(
      `it should ignore the files covered by the local npmignore file`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.npmignore`, `/index.js\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/index\.js/);
      }),
    );

    test(
      `it should ignore the patterns from a gitignore if a npmignore exists`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/b.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.gitignore`, `/a.js\n/b.js\n`);
        await fsUtils.writeFile(`${path}/.npmignore`, `/a.js\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/a\.js/);
        await expect(stdout).toMatch(/b\.js/);
      }),
    );
  });
});
