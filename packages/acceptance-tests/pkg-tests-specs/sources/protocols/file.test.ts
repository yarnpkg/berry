import {xfs, PortablePath, ppath} from '@yarnpkg/fslib';

const {
  tests: {getPackageArchivePath},
} = require(`pkg-tests-core`);

describe(`Protocols`, () => {
  describe(`file:`, () => {
    test(
      `it should update the cache when a file:./folder reference gets updated`,
      makeTemporaryEnv({
        dependencies: {
          [`pkg`]: `file:./folder`,
        },
      }, async ({path, run, source}) => {
        await xfs.mkdirPromise(`${path}/folder` as PortablePath);

        await xfs.writeJsonPromise(`${path}/folder/package.json` as PortablePath, {
          name: `pkg`,
          version: `1.0.0`,
        });

        await xfs.writeFilePromise(`${path}/folder/index.js` as PortablePath, `
          module.exports = 42;
        `);

        await run(`install`);

        await xfs.writeFilePromise(`${path}/folder/index.js` as PortablePath, `
          module.exports = 100;
        `);

        await run(`install`);

        await expect(source(`require('pkg')`)).resolves.toEqual(100);
      }),
    );

    test(
      `it should update the cache when a file:./file.tgz reference gets updated`,
      makeTemporaryEnv({
        dependencies: {
          [`pkg`]: `file:./pkg.tgz`,
        },
      }, async ({path, run, source}) => {
        const noDeps1 = await getPackageArchivePath(`no-deps`, `1.0.0`);
        const noDeps2 = await getPackageArchivePath(`no-deps`, `2.0.0`);

        const destination = ppath.join(path, `pkg.tgz`);

        await xfs.copyPromise(destination, noDeps1);
        await run(`install`);
        await expect(source(`require('pkg/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });

        await xfs.copyPromise(destination, noDeps2);
        await run(`install`);
        await expect(source(`require('pkg/package.json')`)).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });
      }),
    );
  });
});
