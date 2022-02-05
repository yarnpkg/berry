import {ppath, npath, xfs, PortablePath, Filename} from '@yarnpkg/fslib';
import * as tar                                    from 'tar';

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
      }),
    );

    test(
      `it should properly deal with tarballs and dot-slash as first component`,
      makeTemporaryEnv({
        dependencies: {
          [`pkg-tar`]: `./my-tar.tgz`,
        },
      }, async ({path, run}) => {
        const tarDir = ppath.join(path, `tar-gen` as Filename);
        const tarOutFile = ppath.join(path, `my-tar.tgz` as Filename);

        await xfs.mkdirPromise(tarDir);
        await xfs.writeJsonPromise(ppath.join(tarDir, `package.json` as Filename), {
          name: `pkg-tar`,
          version: `1.0.0`,
        });

        // create a tar archive with `./` as first component.
        await tar.c({
          file: npath.fromPortablePath(tarOutFile),
          cwd: npath.fromPortablePath(tarDir),
          gzip: true,
          prefix: `./`,
        }, [`package.json`]);

        await expect(run(`install`)).resolves.toBeTruthy();
      }),
    );
  });
});
