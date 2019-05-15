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
          `/lib/*.js`,
          `/src/b.ts`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/lib/b.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/src/a.ts`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/src/b.ts`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/lib\/a\.js/);
        await expect(stdout).toMatch(/lib\/b\.js/);
        await expect(stdout).not.toMatch(/src\/a\.ts/);
        await expect(stdout).toMatch(/src\/b\.ts/);
      }),
    );

    test(
      `it should always include the manifest, even with a "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib/*.js`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/lib/b.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/lib\/a\.js/);
        await expect(stdout).toMatch(/lib\/b\.js/);
        await expect(stdout).toMatch(/package\.json/);
      }),
    );

    test(
      `it should support excluding patterns from the "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib/*.js`,
          `!/lib/b.js`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/lib/b.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/lib\/a\.js/);
        await expect(stdout).not.toMatch(/lib\/b\.js/);
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

    test(
      `it should override main and module in the packed manifest`,
      makeTemporaryEnv({
        main: `./index.js`,
        module: `./index.mjs`,
        publishConfig: {
          main: `./published.js`,
          module: `./published.mjs`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);
        await run(`pack`);

        await fsUtils.unpackToDirectory(path, `${path}/package.tgz`);

        const packedManifest = await fsUtils.readJson(`${path}/package/package.json`);

        expect(packedManifest.main).toBe(`./published.js`);
        expect(packedManifest.module).toBe(`./published.mjs`);

        const originalManifest = await fsUtils.readJson(`${path}/package.json`);

        expect(originalManifest.main).toBe(`./index.js`);
        expect(originalManifest.module).toBe(`./index.mjs`);
      }),
    );

    test(
      `it should replace the workspace: protocol correctly`,
      makeTemporaryEnv({
        workspaces: ['./dependency', './dependant']
      }, async({path, run, source}) => {
        const dependency = `@test/dependency`;
        const dependant = `@test/dependant`;

        await fsUtils.writeJson(`${path}/dependency/package.json`, {
          name: dependency,
          version: '1.0.0'
        });

        await fsUtils.writeJson(`${path}/dependant/package.json`, {
          name: dependant,
          version: '1.0.0',
          dependencies: {
            [dependency]: `workspace:*`,
          },
          devDependencies: {
            [dependency]: `workspace:^1.0.0`,
          },
          peerDependencies: {
            [dependency]: `workspace:dependency`,
          },
        });

        await run(`install`);
        await run(`pack`, {
          cwd: `${path}/dependant`
        });

        await fsUtils.unpackToDirectory(path, `${path}/dependant/package.tgz`);

        const packedManifest = await fsUtils.readJson(`${path}/package/package.json`);

        expect(packedManifest.dependencies[dependency]).toBe(`1.0.0`);
        expect(packedManifest.devDependencies[dependency]).toBe(`^1.0.0`);
        expect(packedManifest.peerDependencies[dependency]).toBe(`1.0.0`);

        const originalManifest = await fsUtils.readJson(`${path}/dependant/package.json`);

        expect(originalManifest.dependencies[dependency]).toBe(`workspace:*`);
        expect(originalManifest.devDependencies[dependency]).toBe(`workspace:^1.0.0`);
        expect(originalManifest.peerDependencies[dependency]).toBe(`workspace:dependency`);
      }),
    )
  });
});
