import {xfs}           from '@yarnpkg/fslib';
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
      `it shouldn't pack Yarn files by default`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/\.yarn\//);
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
      `it should support excluding folders from the "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/lib/b.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/lib\/a\.js/);
        await expect(stdout).toMatch(/lib\/b\.js/);
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
      `it should ignore root .gitignore files when using the 'files' field`,
      makeTemporaryEnv({
        files: [
          `lib`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/.gitignore`, `lib`);

        await run(`install`);

        await fsUtils.writeFile(`${path}/lib/foo.js`, ``);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).toMatch(/lib\/foo\.js/);
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
      `it should ignore the folders covered by the local npmignore file`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.mkdirp(`${path}/__tests__/`);
        await fsUtils.writeFile(`${path}/__tests__/index.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.npmignore`, `__tests__\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/__tests__/);
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
        workspaces: [`./dependency`, `./dependant`],
      }, async({path, run, source}) => {
        const dependency = `@test/dependency`;
        const dependant = `@test/dependant`;

        await fsUtils.writeJson(`${path}/dependency/package.json`, {
          name: dependency,
          version: `1.0.0`,
        });

        await fsUtils.writeJson(`${path}/dependant/package.json`, {
          name: dependant,
          version: `1.0.0`,
          dependencies: {
            [dependency]: `workspace:*`,
          },
          devDependencies: {
            [dependency]: `workspace:^1.0.0`,
          },
        });

        await run(`install`);
        await run(`pack`, {
          cwd: `${path}/dependant`,
        });

        await fsUtils.unpackToDirectory(path, `${path}/dependant/package.tgz`);

        const packedManifest = await fsUtils.readJson(`${path}/package/package.json`);

        expect(packedManifest.dependencies[dependency]).toBe(`1.0.0`);
        expect(packedManifest.devDependencies[dependency]).toBe(`^1.0.0`);

        const originalManifest = await fsUtils.readJson(`${path}/dependant/package.json`);

        expect(originalManifest.dependencies[dependency]).toBe(`workspace:*`);
        expect(originalManifest.devDependencies[dependency]).toBe(`workspace:^1.0.0`);
      }),
    );

    test(
      `it should always include README (and its variants), even with a "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib/*.js`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/README`, `explaining lib`);
        await fsUtils.writeFile(`${path}/README.md`, `explaining the package`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/lib\/README/);
        await expect(stdout).toMatch(/README\.md/);
        await expect(stdout).toMatch(/package\.json/);
      }),
    );

    test(
      `it should always include CHANGELOG (and its variants), even with a "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib/*.js`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/changelog`, `lib specific changelog`);
        await fsUtils.writeFile(`${path}/CHANGELOG.md`, `package changelog`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        await expect(stdout).not.toMatch(/lib\/changelog/);
        await expect(stdout).toMatch(/CHANGELOG\.md/);
        await expect(stdout).toMatch(/package\.json/);
      }),
    );

    test(
      `it should make the filename non-descriptive by default`,
      makeTemporaryEnv({
        name: `@yarnpkg/core`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`);
        expect(xfs.existsSync(`${path}/package.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should put the file relative to the workspace root by default`,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/subdir`);

        await run(`install`);

        await run(`pack`, {cwd: `${path}/subdir`});
        expect(xfs.existsSync(`${path}/package.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should generate an archive with a custom name when using \`--out\``,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`, `--out`, `my-package.tgz`);
        expect(xfs.existsSync(`${path}/my-package.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should put the file relative to the cwd when using \`--out\``,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await xfs.mkdirpPromise(`${path}/subdir`);

        await run(`install`);

        await run(`pack`, `--out`, `my-package.tgz`, {cwd: `${path}/subdir`});
        expect(xfs.existsSync(`${path}/subdir/my-package.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should replace the \`%s\` pattern in \`--out\``,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`, `--out`, `%s.tgz`);
        expect(xfs.existsSync(`${path}/@scope-test.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should replace the \`%v\` pattern in \`--out\``,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`, `--out`, `%v.tgz`);
        expect(xfs.existsSync(`${path}/0.0.1.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should replace as many patterns as needed in \`--out\``,
      makeTemporaryEnv({
        name: `@scope/test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`, `--out`, `%s-%v.tgz`);
        expect(xfs.existsSync(`${path}/@scope-test-0.0.1.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should replace \`%s\` even if the package has no scope`,
      makeTemporaryEnv({
        name: `test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);

        await run(`pack`, `--out`, `%s-%v.tgz`);
        expect(xfs.existsSync(`${path}/test-0.0.1.tgz`)).toEqual(true);
      }),
    );

    test(
      `it should support writing the archive in a absolute destination`,
      makeTemporaryEnv({
        name: `test`,
        version: `0.0.1`,
      }, async ({path, run, source}) => {
        await run(`install`);
        const tmpDir = await xfs.mktempPromise();

        await run(`pack`, `--out`, `${tmpDir}/test.tgz`);
        expect(xfs.existsSync(`${tmpDir}/test.tgz`)).toEqual(true);
      }),
    );
  });
});
