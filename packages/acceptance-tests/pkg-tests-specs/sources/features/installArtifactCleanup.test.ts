import {Filename, PortablePath, xfs} from '@yarnpkg/fslib';

describe(`Install Artifact Cleanup`, () => {
  describe(`pnpm linker`, () => {
    it(`should not generate a node_modules folder if it has nothing to put inside it`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove the node_modules folder after adding and removing a dependency`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await run(`remove`, `no-deps`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should not remove the node_modules folder after adding and removing a dependency if it contains a dot folder`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.cache` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.cache/foo` as PortablePath, ``);

      await run(`remove`, `no-deps`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.cache/foo` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should remove extraneous root entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/foo/bar` as PortablePath, ``);

      await run(`remove`, `no-deps`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should not remove extraneous files in valid root entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/no-deps/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/no-deps/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps/foo/bar` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should remove extraneous nested entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `one-fixed-dep@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/foo` as PortablePath)).resolves.toStrictEqual(false);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should not remove extraneous files in valid nested entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `one-fixed-dep@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps/foo/bar` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should not overwrite files`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps/index.js` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/no-deps/index.js` as PortablePath, `module.exports = \`changed\`;`);

      await run(`install`);

      await expect(xfs.readFilePromise(`${path}/${Filename.nodeModules}/no-deps/index.js` as PortablePath, `utf8`)).resolves.toStrictEqual(`module.exports = \`changed\`;`);
      await expect(source(`require(\`no-deps\`)`)).resolves.toStrictEqual(`changed`);
    }));

    it(`should remove extraneous .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/foo/bar` as PortablePath, ``);

      await run(`remove`, `no-deps`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove the node_modules folder after switching to the pnp linker`, makeTemporaryEnv({}, {}, async ({path, run, source}) => {
      await run(`config`, `set`, `nodeLinker`, `pnpm`);

      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);

      await run(`config`, `set`, `nodeLinker`, `pnp`);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove the .store after switching to the node-modules linker`, makeTemporaryEnv({}, {}, async ({path, run, source}) => {
      await run(`config`, `set`, `nodeLinker`, `pnpm`);

      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);

      await run(`config`, `set`, `nodeLinker`, `node-modules`);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(false);
    }));
  });
});
