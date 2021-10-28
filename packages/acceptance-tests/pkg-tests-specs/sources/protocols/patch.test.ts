import {xfs, ppath, Filename, PortablePath} from '@yarnpkg/fslib';

const {
  tests: {getPackageDirectoryPath},
} = require(`pkg-tests-core`);

const NO_DEPS_PATCH = `diff --git a/index.js b/index.js
index a6bf8f58..629b6aa8 100644
--- a/index.js
+++ b/index.js
@@ -2,6 +2,8 @@

 module.exports = require(\`./package.json\`);

+module.exports.hello = \`world\`;
+
 for (const key of [\`dependencies\`, \`devDependencies\`, \`peerDependencies\`]) {
   for (const dep of Object.keys(module.exports[key] || {})) {
     // $FlowFixMe The whole point of this file is to be dynamic
`;

const PATCH_NAME = `my-patch.patch` as Filename;

describe(`Protocols`, () => {
  describe(`patch:`, () => {
    test(
      `it should apply a patch on the original package`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH);

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
            hello: `world`,
          });
        },
      ),
    );

    test(
      `it should generate the same file twice in a row`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH);

          await run(`install`);

          await xfs.removePromise(ppath.join(path, `.yarn/cache` as PortablePath));
          await xfs.removePromise(ppath.join(path, `.yarn/global` as PortablePath));

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
            hello: `world`,
          });
        },
      ),
    );

    test(
      `it should generate the same file twice in a row (delayed)`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH);

          await run(`install`);

          await xfs.removePromise(ppath.join(path, `.yarn/cache` as PortablePath));
          await xfs.removePromise(ppath.join(path, `.yarn/global` as PortablePath));

          // At least three seconds because Zip archives are precise to two
          // seconds, not one. One extra second will ensure that the file
          // timestamps will always have a chance to tick.
          await new Promise(resolve => setTimeout(resolve, 3000));

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `1.0.0`,
            hello: `world`,
          });
        },
      ),
      10000,
    );

    test(
      `it should preserve the resolution when switching in and out of a patch`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH);

          await run(`install`);

          await run(`set`, `resolution`, `no-deps@npm:1.0.0`, `npm:2.0.0`);

          await xfs.writeJsonPromise(ppath.join(path, `package.json` as PortablePath), {
            dependencies: {
              [`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`,
            },
          });

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
            hello: `world`,
          });

          await xfs.writeJsonPromise(ppath.join(path, `package.json` as PortablePath), {
            dependencies: {
              [`no-deps`]: `1.0.0`,
            },
          });

          await run(`install`);

          await expect(source(`require('no-deps')`)).resolves.toMatchObject({
            name: `no-deps`,
            version: `2.0.0`,
          });

          await expect(source(`require('no-deps')`)).resolves.not.toMatchObject({
            hello: `world`,
          });
        },
      ),
      10000,
    );

    test(
      `it should apply patches relative to the package`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await xfs.mktempPromise(async fileTarget => {
            await xfs.writeFilePromise(ppath.join(fileTarget, PATCH_NAME), NO_DEPS_PATCH);
            await xfs.writeFilePromise(ppath.join(fileTarget, `index.js` as Filename), `module.exports = require('no-deps');`);
            await xfs.writeJsonPromise(ppath.join(fileTarget, Filename.manifest), {
              dependencies: {[`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`},
            });

            await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
              dependencies: {[`file`]: `file:${fileTarget}`},
            });

            await run(`install`);

            await expect(source(`require('file')`)).resolves.toMatchObject({
              name: `no-deps`,
              version: `1.0.0`,
              hello: `world`,
            });
          });
        },
      ),
    );

    test(
      `it should throw on invalid patch files`,
      makeTemporaryEnv(
        {
          dependencies: {[`no-deps`]: `patch:no-deps@1.0.0#${PATCH_NAME}`},
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH, {encoding: `utf16le`});

          await expect(run(`install`)).rejects.toMatchObject({
            code: 1,
            stdout: expect.stringContaining(`Unable to parse patch file: No changes found`),
          });
        },
      ),
    );

    test(
      `it should support applying a patch on a patch`,
      makeTemporaryEnv(
        {
          dependencies: {
            [`no-deps`]: getPackageDirectoryPath(`no-deps`, `1.0.0`).then((pkgPath: any) => `patch:no-deps@${encodeURIComponent(`file:${pkgPath}`)}#${PATCH_NAME}`),
          },
        },
        async ({path, run, source}) => {
          await xfs.writeFilePromise(ppath.join(path, PATCH_NAME), NO_DEPS_PATCH);

          await run(`install`);
        },
      ),
    );
  });
});
