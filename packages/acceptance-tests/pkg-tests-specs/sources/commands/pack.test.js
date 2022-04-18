import {xfs, npath}    from '@yarnpkg/fslib';
import {fs as fsUtils} from 'pkg-tests-core';
import tar             from 'tar';

describe(`Commands`, () => {
  describe(`pack`, () => {
    test(
      `it should list all the files in a package`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toMatch(/index\.js/);
      }),
    );

    test(
      `it shouldn't pack Yarn files by default`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/\.yarn\//);
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
        expect(stdout).toMatch(/lib\/a\.js/);
        expect(stdout).toMatch(/lib\/b\.js/);
        expect(stdout).not.toMatch(/src\/a\.ts/);
        expect(stdout).toMatch(/src\/b\.ts/);
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
        expect(stdout).toMatch(/lib\/a\.js/);
        expect(stdout).toMatch(/lib\/b\.js/);
        expect(stdout).toMatch(/package\.json/);
      }),
    );

    test(
      `it should always include the main file, even with a "files" field`,
      makeTemporaryEnv({
        main: `ok1.js`,
        module: `ok2.js`,
        browser: `ok3.js`,
        files: [
          `/bad`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/ok1.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ok2.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ok3.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ko.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toMatch(/ok1\.js/);
        expect(stdout).toMatch(/ok2\.js/);
        expect(stdout).toMatch(/ok3\.js/);
        expect(stdout).not.toMatch(/ko\.js/);
      }),
    );

    test(
      `it should support when the "browser" field is an object`,
      makeTemporaryEnv({
        browser: {
          [`ok1.js`]: false,
          [`ok2.js`]: `ok3.js`,
        },
        files: [
          `/bad`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/ok1.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ok2.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ok3.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ko.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toMatch(/ok1\.js/);
        expect(stdout).toMatch(/ok2\.js/);
        expect(stdout).toMatch(/ok3\.js/);
        expect(stdout).not.toMatch(/ko\.js/);
      }),
    );

    test(
      `it should always include the binary files, even with a "files" field`,
      makeTemporaryEnv({
        bin: {
          ok: `ok.js`,
        },
        files: [
          `/bad`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/ok.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/ko.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toMatch(/ok\.js/);
        expect(stdout).not.toMatch(/ko\.js/);
      }),
    );

    test(
      `it should support excluding patterns in included parent directory from the "files" field`,
      makeTemporaryEnv({
        files: [
          `/lib`,
          `!/lib/b.js`,
        ],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/lib/b.js`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toContain(`lib/a.js`);
        expect(stdout).not.toContain(`lib/b.js`);
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
        expect(stdout).toMatch(/lib\/a\.js/);
        expect(stdout).not.toMatch(/lib\/b\.js/);
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
        expect(stdout).toMatch(/lib\/a\.js/);
        expect(stdout).toMatch(/lib\/b\.js/);
      }),
    );

    test(
      `it shouldn't add .gitignore files to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/.gitignore`, ``);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/\.gitignore/);
      }),
    );

    test(
      `it shouldn't add .npmignore files to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/.npmignore`, ``);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/\.npmignore/);
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
        expect(stdout).toMatch(/lib\/foo\.js/);
      }),
    );

    test(
      `it shouldn't add the cache to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/\.yarn\/cache/);
      }),
    );

    test(
      `it shouldn't add the lockfile to the package files`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/yarn\.lock/);
      }),
    );

    test(
      `it should ignore the files covered by the local gitignore file`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.gitignore`, `/index.js\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/index\.js/);
      }),
    );

    test(
      `it should ignore the files covered by the local npmignore file`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/index.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/.npmignore`, `/index.js\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).not.toMatch(/index\.js/);
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
        expect(stdout).not.toMatch(/__tests__/);
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
        expect(stdout).not.toMatch(/a\.js/);
        expect(stdout).toMatch(/b\.js/);
      }),
    );

    test(
      `it should override fields in the packed manifest`,
      makeTemporaryEnv({
        type: `commonjs`,
        main: `./index.js`,
        module: `./index.mjs`,
        browser: `./index.umd.js`,
        exports: `./index.modern.js`,
        publishConfig: {
          type: `module`,
          main: `./published.js`,
          module: `./published.mjs`,
          browser: `./published.umd.js`,
          exports: `./published.modern.js`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);
        await run(`pack`);

        await fsUtils.unpackToDirectory(path, `${path}/package.tgz`);

        const packedManifest = await fsUtils.readJson(`${path}/package/package.json`);

        expect(packedManifest.type).toBe(`module`);
        expect(packedManifest.main).toBe(`./published.js`);
        expect(packedManifest.module).toBe(`./published.mjs`);
        expect(packedManifest.browser).toBe(`./published.umd.js`);
        expect(packedManifest.exports).toBe(`./published.modern.js`);

        const originalManifest = await fsUtils.readJson(`${path}/package.json`);

        expect(originalManifest.type).toBe(`commonjs`);
        expect(originalManifest.main).toBe(`./index.js`);
        expect(originalManifest.module).toBe(`./index.mjs`);
        expect(originalManifest.browser).toBe(`./index.umd.js`);
        expect(originalManifest.exports).toBe(`./index.modern.js`);
      }),
    );

    test(
      `it should replace the workspace: protocol correctly`,
      makeTemporaryEnv({
        workspaces: [`./dependency`, `./dependant`, `./optional`, `./foo`, `./bar`],
      }, async({path, run, source}) => {
        const dependency = `@test/dependency`;
        const dependant = `@test/dependant`;
        const optional = `@test/optional`;
        const foo = `@test/foo`;
        const bar = `@test/bar`;

        await fsUtils.writeJson(`${path}/dependency/package.json`, {
          name: dependency,
          version: `1.0.0`,
        });

        await fsUtils.writeJson(`${path}/foo/package.json`, {
          name: foo,
          version: `2.0.0`,
        });

        await fsUtils.writeJson(`${path}/bar/package.json`, {
          name: bar,
          version: `3.0.0`,
        });

        await fsUtils.writeJson(`${path}/optional/package.json`, {
          name: optional,
          version: `4.0.0`,
        });

        await fsUtils.writeJson(`${path}/dependant/package.json`, {
          name: dependant,
          version: `1.0.0`,
          dependencies: {
            [dependency]: `workspace:*`,
            [foo]: `workspace:^`,
            [bar]: `workspace:~`,
          },
          devDependencies: {
            [dependency]: `workspace:^1.0.0`,
          },
          peerDependencies: {
            [dependency]: `workspace:*`,
            [foo]: `workspace:^`,
            [bar]: `workspace:~`,
          },
          optionalDependencies: {
            [optional]: `workspace:*`,
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
        expect(packedManifest.dependencies[foo]).toBe(`^2.0.0`);
        expect(packedManifest.dependencies[bar]).toBe(`~3.0.0`);
        expect(packedManifest.peerDependencies[dependency]).toBe(`1.0.0`);
        expect(packedManifest.peerDependencies[foo]).toBe(`^2.0.0`);
        expect(packedManifest.peerDependencies[bar]).toBe(`~3.0.0`);
        expect(packedManifest.optionalDependencies[optional]).toBe(`4.0.0`);

        const originalManifest = await fsUtils.readJson(`${path}/dependant/package.json`);

        expect(originalManifest.dependencies[dependency]).toBe(`workspace:*`);
        expect(originalManifest.devDependencies[dependency]).toBe(`workspace:^1.0.0`);
        expect(originalManifest.dependencies[foo]).toBe(`workspace:^`);
        expect(originalManifest.dependencies[bar]).toBe(`workspace:~`);
        expect(originalManifest.peerDependencies[dependency]).toBe(`workspace:*`);
        expect(originalManifest.peerDependencies[foo]).toBe(`workspace:^`);
        expect(originalManifest.peerDependencies[bar]).toBe(`workspace:~`);
        expect(originalManifest.optionalDependencies[optional]).toBe(`workspace:*`);
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
        expect(stdout).not.toMatch(/lib\/README/);
        expect(stdout).toMatch(/README\.md/);
        expect(stdout).toMatch(/package\.json/);
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
        expect(stdout).not.toMatch(/lib\/changelog/);
        expect(stdout).toMatch(/CHANGELOG\.md/);
        expect(stdout).toMatch(/package\.json/);
      }),
    );

    test(
      `it should never set the +x flag on files in general`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/index.js`, `module.exports = 42;`);
        await xfs.chmodPromise(`${path}/index.js`, 0o755);

        await run(`install`);
        await run(`pack`);

        const mode = await new Promise(resolve => {
          tar.t({
            file: npath.fromPortablePath(`${path}/package.tgz`),
            onentry: entry => resolve(entry.mode),
          }, [`package/index.js`]);
        });

        expect(mode).toEqual(0o644);
      }),
    );

    test(
      `it should set the +x flag on bin entries`,
      makeTemporaryEnv({
        name: `pkg`,
        bin: `index.js`,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/index.js`, `module.exports = 42;`);

        await run(`install`);
        await run(`pack`);

        const mode = await new Promise(resolve => {
          tar.t({
            file: npath.fromPortablePath(`${path}/package.tgz`),
            onentry: entry => resolve(entry.mode),
          }, [`package/index.js`]);
        });

        expect(mode).toEqual(0o755);
      }),
    );

    test(
      `it should set the +x flag executableFiles entries`,
      makeTemporaryEnv({
        publishConfig: {
          executableFiles: [
            `index.js`,
          ],
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/index.js`, `module.exports = 42;`);

        await run(`install`);
        await run(`pack`);

        const mode = await new Promise(resolve => {
          tar.t({
            file: npath.fromPortablePath(`${path}/package.tgz`),
            onentry: entry => resolve(entry.mode),
          }, [`package/index.js`]);
        });

        expect(mode).toEqual(0o755);
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

    test(
      `it should not include any extra files when the "files" field is empty`,
      makeTemporaryEnv({
        main: `lib/a.js`,
        files: [],
      }, async ({path, run, source}) => {
        await fsUtils.writeFile(`${path}/lib/a.js`, `module.exports = 42;\n`);
        await fsUtils.writeFile(`${path}/src/a.ts`, `module.exports = 42;\n`);

        await run(`install`);

        const {stdout} = await run(`pack`, `--dry-run`);
        expect(stdout).toMatch(/lib\/a\.js/);
        expect(stdout).not.toMatch(/src\/a\.ts/);
      }),
    );

    test(
      `it should reflect changes made to package.json during prepack`,
      makeTemporaryEnv({
        workspaces: [`./dependency`, `./dependant`],
      }, async({path, run, source}) => {
        const dependency = `@test/dependency`;
        const dependant = `@test/dependant`;

        await fsUtils.writeJson(`${path}/dependency/package.json`, {
          name: dependency,
          version: `1.0.0`,
        });

        const packageJson = {
          name: dependant,
          version: `1.0.0`,
          scripts: {
            prepack: `cp package.json package.json.bak && cp package.json.tmp package.json`,
            postpack: `mv package.json.bak package.json`,
          },
          devDependencies: {
            [dependency]: `workspace:*`,
          },
        };

        await fsUtils.writeJson(`${path}/dependant/package.json`, packageJson);
        await fsUtils.writeJson(`${path}/dependant/package.json.tmp`, {
          ...packageJson,
          dependencies: {
            [dependency]: `workspace:^1.0.0`,
          },
        });

        await run(`install`);
        await run(`pack`, {
          cwd: `${path}/dependant`,
        });

        await fsUtils.unpackToDirectory(path, `${path}/dependant/package.tgz`);

        const packedManifest = await fsUtils.readJson(`${path}/package/package.json`);

        expect(packedManifest.dependencies[dependency]).toBe(`^1.0.0`);
        expect(packedManifest.devDependencies[dependency]).toBe(`1.0.0`);

        const originalManifest = await fsUtils.readJson(`${path}/dependant/package.json`);

        expect(originalManifest.dependencies).toBe(undefined);
        expect(originalManifest.devDependencies[dependency]).toBe(`workspace:*`);
      }),
    );
  });
});
