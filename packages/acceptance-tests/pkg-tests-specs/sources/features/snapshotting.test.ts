import {execUtils} from '@yarnpkg/core';

const BUNDLE_PATH = require.resolve(`${__dirname}/../../../../yarnpkg-cli/bundles/yarn.js`);

describe(`Features`, () => {
  describe(`Snapshotting`, () => {
    it(`should support building a snapshot`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await execUtils.execvp(`node`, [`--snapshot-blob`, `snapshot.blob`, `--build-snapshot`, BUNDLE_PATH], {
        cwd: path,
      });
    }));

    for (const args of [[`--version`], [`install`], [`run`]]) {
      it(`should support running a snapshot (${args.join(` `)})`, makeTemporaryEnv({
        dependencies: {
          [`no-deps`]: `1.0.0`,
        },
      }, async ({path, run, source}) => {
        await execUtils.execvp(`node`, [`--snapshot-blob`, `snapshot.blob`, `--build-snapshot`, BUNDLE_PATH], {
          cwd: path,
        });

        const {stdout} = await run(...args, {
          env: {
            NODE_OPTIONS: `--snapshot-blob snapshot.blob`,
          },
        });

        expect(stdout).toMatchSnapshot();
      }));
    }
  });
});
