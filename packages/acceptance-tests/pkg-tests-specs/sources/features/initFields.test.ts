import {PortablePath, xfs}     from '@yarnpkg/fslib';
import {createTemporaryFolder} from 'pkg-tests-core/sources/utils/fs';
import {yarn}                  from 'pkg-tests-core';

describe(`Features`, () => {
  describe(`initFields`, () => {
    test(
      `it should add string fields to the generated manifest`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await yarn.writeConfiguration(tmp, {
            initFields: {
              homepage: `https://yarnpkg.com`,
            },
          });

          await xfs.mkdirpPromise(`${tmp}/my-package` as PortablePath);

          await run(`init`, {
            cwd: `${tmp}/my-package`,
          });

          await expect(xfs.readJsonPromise(`${tmp}/my-package/package.json` as PortablePath)).resolves.toMatchObject({
            name: `my-package`,
            homepage: `https://yarnpkg.com`,
          });
        },
      ),
    );

    test(
      `it should add array fields to the generated manifest`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await yarn.writeConfiguration(tmp, {
            initFields: {
              files: [
                `/lib/**/*`,
                `/bin/**/*`,
              ],
            },
          });

          await xfs.mkdirpPromise(`${tmp}/my-package` as PortablePath);

          await run(`init`, {
            cwd: `${tmp}/my-package`,
          });

          await expect(xfs.readJsonPromise(`${tmp}/my-package/package.json` as PortablePath)).resolves.toMatchObject({
            name: `my-package`,
            files: [
              `/lib/**/*`,
              `/bin/**/*`,
            ],
          });
        },
      ),
    );

    // These ones were broken before https://github.com/yarnpkg/berry/issues/2230 got fixed

    test(
      `it should add the version field to the generated manifest`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await yarn.writeConfiguration(tmp, {
            initFields: {
              version: `1.2.3`,
            },
          });

          await xfs.mkdirpPromise(`${tmp}/my-package` as PortablePath);

          await run(`init`, {
            cwd: `${tmp}/my-package`,
          });

          await expect(xfs.readJsonPromise(`${tmp}/my-package/package.json` as PortablePath)).resolves.toMatchObject({
            name: `my-package`,
            version: `1.2.3`,
          });
        },
      ),
    );

    test(
      `it should add the license field to the generated manifest`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          const tmp = await createTemporaryFolder();

          await yarn.writeConfiguration(tmp, {
            initFields: {
              license: `MIT`,
            },
          });

          await xfs.mkdirpPromise(`${tmp}/my-package` as PortablePath);

          await run(`init`, {
            cwd: `${tmp}/my-package`,
          });

          await expect(xfs.readJsonPromise(`${tmp}/my-package/package.json` as PortablePath)).resolves.toMatchObject({
            name: `my-package`,
            license: `MIT`,
          });
        },
      ),
    );
  });
});
