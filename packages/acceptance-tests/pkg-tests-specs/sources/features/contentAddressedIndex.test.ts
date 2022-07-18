import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Content-Addressed Index`, () => {
    test(
      `it should use the exact same device/inode for the same file from the same package`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        nodeLinker: `pnpm`,
      }, async ({path, run, source}) => {
        await xfs.mktempPromise(async path2 => {
          await xfs.writeJsonPromise(ppath.join(path2, Filename.manifest), {
            name: `my-package`,
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });

          await run(`install`, {cwd: path});
          await run(`install`, {cwd: path2});

          const statA = await xfs.statPromise(ppath.join(path, `node_modules/no-deps/package.json` as PortablePath));
          const statB = await xfs.statPromise(ppath.join(path, `node_modules/no-deps/package.json` as PortablePath));

          expect({
            dev: statA.dev,
            ino: statA.ino,
          }).toEqual({
            dev: statB.dev,
            ino: statB.ino,
          });
        });
      }),
    );

    test(
      `it should use the exact same device/inode for the same file from different packages`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        nodeLinker: `pnpm`,
      }, async ({path, run, source}) => {
        await xfs.mktempPromise(async path2 => {
          await xfs.writeJsonPromise(ppath.join(path2, Filename.manifest), {
            name: `my-package`,
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`, {cwd: path});
          await run(`install`, {cwd: path2});

          const statA = await xfs.statPromise(ppath.join(path, `node_modules/no-deps/index.js` as PortablePath));
          const statB = await xfs.statPromise(ppath.join(path, `node_modules/no-deps/index.js` as PortablePath));

          expect({
            dev: statA.dev,
            ino: statA.ino,
          }).toEqual({
            dev: statB.dev,
            ino: statB.ino,
          });
        });
      }),
    );

    test(
      `it should detect when an index file was modified, and automatically repair it`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        nodeLinker: `pnpm`,
      }, async ({path, run, source}) => {
        await xfs.mktempPromise(async path2 => {
          await run(`install`);

          const referenceFile = ppath.join(path, `node_modules/no-deps/index.js` as PortablePath);

          const originalContent = await xfs.readFilePromise(referenceFile, `utf8`);
          const newContent = `${originalContent}// oh no, modified\n`;

          await xfs.writeFilePromise(referenceFile, newContent);

          await run(`install`);

          await expect(xfs.readFilePromise(referenceFile, `utf8`)).resolves.toEqual(originalContent);
        });
      }),
    );

    test(
      `it should repair the index across all projects, not only the current one`,
      makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, {
        nodeLinker: `pnpm`,
      }, async ({path, run, source}) => {
        await xfs.mktempPromise(async path2 => {
          await xfs.writeJsonPromise(ppath.join(path2, Filename.manifest), {
            name: `my-package`,
            dependencies: {
              [`no-deps`]: `2.0.0`,
            },
          });

          await run(`install`, {cwd: path});
          await run(`install`, {cwd: path2});

          const referenceFileA = ppath.join(path, `node_modules/no-deps/index.js` as PortablePath);
          const referenceFileB = ppath.join(path, `node_modules/no-deps/index.js` as PortablePath);

          const originalContent = await xfs.readFilePromise(referenceFileA, `utf8`);
          const newContent = `${originalContent}// oh no, modified\n`;

          await xfs.writeFilePromise(referenceFileA, newContent);

          await run(`install`, {cwd: path});

          await expect(xfs.readFilePromise(referenceFileA, `utf8`)).resolves.toEqual(originalContent);
          await expect(xfs.readFilePromise(referenceFileB, `utf8`)).resolves.toEqual(originalContent);
        });
      }),
    );
  });
});
