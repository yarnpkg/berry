import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';

const {
  tests: {startPackageServer},
  fs: {writeFile},
} = require(`pkg-tests-core`);

describe(`Commands`, () => {
  describe(`patch-commit`, () => {
    test(
      `it should generate a patch from a package folder`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `no-deps`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await expect(run(`patch-commit`, updateFolder)).resolves.toMatchSnapshot();
      }),
    );

    test(
      `it should save patches into a local folder if requested`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));
        await run(`install`);

        await expect(source(`require('one-fixed-dep')`)).resolves.toMatchObject({
          dependencies: {
            [`no-deps`]: 42,
          },
        });
      }),
    );

    test(
      `it should reference patches from the workspace dependencies when possible`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
        });

        expect(manifest).not.toHaveProperty(`resolutions`);
      }),
    );

    test(
      `it should reference patches using the 'resolutions' field when required`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `no-deps`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`one-fixed-dep`]: `1.0.0`,
        });

        expect(manifest.resolutions).toEqual({
          [`no-deps@npm:1.0.0`]: `patch:no-deps@npm%3A1.0.0#~/.yarn/patches/no-deps-npm-1.0.0-cf533b267a.patch`,
        });
      }),
    );

    test(
      `it should replace the patch when calling patch-commit again, not wrap it into another patch layer`,
      makeTemporaryEnv({
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        {
          const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `new.js`);

          const fileUser = `module.exports = 42;\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

          const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

          expect(manifest.dependencies).toEqual({
            [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
          });
        }

        {
          const {stdout} = await run(`patch`, `one-fixed-dep`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `new.js`);

          const fileUser = `module.exports = 21;\n`;
          await xfs.writeFilePromise(updateFile, fileUser);

          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

          const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

          expect(manifest.dependencies).toEqual({
            [`one-fixed-dep`]: `patch:one-fixed-dep@npm%3A1.0.0#~/.yarn/patches/one-fixed-dep-npm-1.0.0-b02516a4af.patch`,
          });
        }
      }),
    );

    test(
      `it should be able to patch virtual packages`,
      makeTemporaryEnv({
        dependencies: {
          [`peer-deps-lvl0`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `peer-deps-lvl1`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(`require(dep)`, `42`);
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`peer-deps-lvl0`]: `1.0.0`,
        });

        expect(manifest.resolutions).toEqual({
          [`peer-deps-lvl1@npm:1.0.0`]: `patch:peer-deps-lvl1@npm%3A1.0.0#~/.yarn/patches/peer-deps-lvl1-npm-1.0.0-894d37389e.patch`,
        });
      }),
    );

    test(
      `it should preserve __archiveUrl parameters in patch URLs`,
      makeTemporaryEnv({
        dependencies: {
          [`unconventional-tarball`]: `npm:1.0.0::__archiveUrl=https://registry.example.org/unconventional-tarball/tralala/unconventional-tarball-1.0.0.tgz`,
        },
      }, async ({path, run}) => {
        await run(`install`);

        const {stdout} = await run(`patch`, `unconventional-tarball`, `--json`);
        const {path: updateFolderN} = JSON.parse(stdout);

        const updateFolder = npath.toPortablePath(updateFolderN);
        const updateFile = ppath.join(updateFolder, `index.js`);

        const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
        const fileUser = fileSource.replace(
          `module.exports = require(\`./package.json\`);`,
          `module.exports = require(\`./package.json\`);\n\nmodule.exports.hello = \`world\`;`,
        );
        await xfs.writeFilePromise(updateFile, fileUser);

        await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

        const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));

        expect(manifest.dependencies).toEqual({
          [`unconventional-tarball`]: expect.stringMatching(/^patch:unconventional-tarball@npm%3A1\.0\.0#.*::__archiveUrl=https%3A%2F%2Fregistry\.example\.org/),
        });

        // Ensure the patch URL format is correct (not malformed)
        expect(manifest.dependencies[`unconventional-tarball`]).not.toMatch(/^patch:.*::.*#/);
      }),
    );

    test(
      `it should generate proper patch URLs for packages with unconventional tarball urls`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`unconventional-tarball`]: `npm:1.0.0::__archiveUrl=https://registry.example.org/unconventional-tarball/tralala/unconventional-tarball-1.0.0.tgz`,
          },
        },
        async ({path, run, source}) => {
          const url = await startPackageServer({type: `https`});

          await writeFile(ppath.join(path, `.yarnrc.yml`), [
            `npmScopes:`,
            `  private:`,
            `    npmRegistryServer: "${url}"`,
          ].join(`\n`));

          await run(`install`);

          // Use yarn patch to get a temporary folder
          const {stdout} = await run(`patch`, `unconventional-tarball`, `--json`);
          const {path: updateFolderN} = JSON.parse(stdout);

          const updateFolder = npath.toPortablePath(updateFolderN);
          const updateFile = ppath.join(updateFolder, `index.js`);

          // Make the same modification as our patch
          const fileSource = await xfs.readFilePromise(updateFile, `utf8`);
          const fileUser = fileSource.replace(
            `module.exports = require(\`./package.json\`);`,
            `module.exports = require(\`./package.json\`);\n\nmodule.exports.hello = \`world\`;`,
          );
          await xfs.writeFilePromise(updateFile, fileUser);

          // Commit the patch
          await run(`patch-commit`, `-s`, npath.fromPortablePath(updateFolder));

          // Read the manifest to check the generated patch URL format
          const manifest = await xfs.readJsonPromise(ppath.join(path, Filename.manifest));
          const patchUrl = manifest.dependencies[`unconventional-tarball`];

          // Verify the patch URL has the correct format: patch:source#selector::params
          expect(patchUrl).toMatch(/^patch:unconventional-tarball@npm%3A1\.0\.0#.*::__archiveUrl=/);

          // Verify it's NOT the malformed format: patch:source::params#selector
          expect(patchUrl).not.toMatch(/^patch:unconventional-tarball@npm%3A1\.0\.0::.*#.*$/);

          // Run install again to apply the patch
          await run(`install`);

          // Verify the patch was applied correctly
          await expect(source(`require('unconventional-tarball')`)).resolves.toMatchObject({
            name: `unconventional-tarball`,
            version: `1.0.0`,
            hello: `world`,
          });
        },
      ),
    );
  });
});
