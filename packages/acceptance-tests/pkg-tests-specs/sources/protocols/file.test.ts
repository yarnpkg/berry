import {xfs, PortablePath} from '@yarnpkg/fslib';

describe(`Protocols`, () => {
  describe(`file:`, () => {
    test(
      `it should update the cache`,
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
      })
    );
  });
});
