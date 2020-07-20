import {npath} from '@yarnpkg/fslib';

const {
  fs: {mkdirp, writeFile},
  misc: {parseJsonStream},
} = require(`pkg-tests-core`);

describe(`Features`, () => {
  describe(`Project detection`, () => {
    test(
      `it should detect the project in the current directory`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          expect(parseJsonStream(
            (await run(`config`, `--json`)).stdout,
            `key`,
          )).toMatchObject({
            [`cacheFolder`]: {
              effective: npath.fromPortablePath(`${path}/.yarn/cache`),
            },
          });
        },
      ),
    );

    test(
      `it should move upward until it finds the project`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await mkdirp(`${path}/subfolder`);

          await writeFile(`${path}/subfolder/package.json`, `{}`);

          expect(parseJsonStream(
            (await run(`config`, `--json`, {cwd: `${path}/subfolder`})).stdout,
            `key`,
          )).toMatchObject({
            [`cacheFolder`]: {
              effective: npath.fromPortablePath(`${path}/.yarn/cache`),
            },
          });
        },
      ),
    );

    test(
      `it shouldn't cross past lockfiles`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await mkdirp(`${path}/subfolder`);

          await writeFile(`${path}/subfolder/package.json`, `{}`);
          await writeFile(`${path}/subfolder/yarn.lock`, ``);

          expect(parseJsonStream(
            (await run(`config`, `--json`, {cwd: `${path}/subfolder`})).stdout,
            `key`,
          )).toMatchObject({
            [`cacheFolder`]: {
              effective: npath.fromPortablePath(`${path}/subfolder/.yarn/cache`),
            },
          });
        },
      ),
    );
  });
});
