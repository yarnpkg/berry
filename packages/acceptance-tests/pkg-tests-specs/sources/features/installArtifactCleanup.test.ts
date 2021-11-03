import {Filename, PortablePath, xfs} from '@yarnpkg/fslib';

const lsStore = async (path: PortablePath) => {
  return await xfs.readdirPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath);
};

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

    it(`should remove the node_modules folder after adding and removing a scoped dependency`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `@types/no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await run(`remove`, `@types/no-deps`);

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

    it(`should not remove dependencies with the same scope when removing a scoped dependency`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `@types/no-deps@1.0.0`, `@types/is-number@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/no-deps` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/is-number` as PortablePath)).resolves.toStrictEqual(true);

      await run(`remove`, `@types/no-deps`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/no-deps` as PortablePath)).resolves.toStrictEqual(false);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/is-number` as PortablePath)).resolves.toStrictEqual(true);
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

    it(`should remove extraneous root entries that look like scopes`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/@foo` as PortablePath);

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

      const entries = await lsStore(path);
      const oneFixedDepEntry = entries.find(entry => entry.startsWith(`one-fixed-dep`));
      expect(oneFixedDepEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/foo` as PortablePath)).resolves.toStrictEqual(false);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should remove extraneous nested entries that look like scopes`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `one-fixed-dep@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const oneFixedDepEntry = entries.find(entry => entry.startsWith(`one-fixed-dep`));
      expect(oneFixedDepEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/@foo` as PortablePath);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/@foo` as PortablePath)).resolves.toStrictEqual(false);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should remove extraneous nested entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/foo` as PortablePath)).resolves.toStrictEqual(false);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should not remove extraneous files in valid nested entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `one-fixed-dep@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/one-fixed-dep/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const oneFixedDepEntry = entries.find(entry => entry.startsWith(`one-fixed-dep`));
      expect(oneFixedDepEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${oneFixedDepEntry}/node_modules/one-fixed-dep/node_modules/no-deps/foo/bar` as PortablePath)).resolves.toStrictEqual(true);
    }));

    it(`should not remove extraneous files in valid nested entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap/${Filename.nodeModules}/self-require-trap/foo/bar` as PortablePath)).resolves.toStrictEqual(true);
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

    it(`should remove extraneous files in .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const noDepsEntry = entries.find(entry => entry.startsWith(`no-deps`));
      expect(noDepsEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files in .store entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const selfRequireTrapEntry = entries.find(entry => entry.startsWith(`self-require-trap-npm-1.0.0`));
      expect(selfRequireTrapEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/self-require-trap/node_modules/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files in the prefix path of .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const noDepsEntry = entries.find(entry => entry.startsWith(`no-deps`));
      expect(noDepsEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files in the prefix path of .store entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const selfRequireTrapEntry = entries.find(entry => entry.startsWith(`self-require-trap-npm-1.0.0`));
      expect(selfRequireTrapEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/self-require-trap/node_modules/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files that look like scopes in the prefix path of .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const noDepsEntry = entries.find(entry => entry.startsWith(`no-deps`));
      expect(noDepsEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/@foo` as PortablePath);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/@foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files that look like scopes in the prefix path of .store entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const selfRequireTrapEntry = entries.find(entry => entry.startsWith(`self-require-trap-npm-1.0.0`));
      expect(selfRequireTrapEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/self-require-trap/node_modules/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/@foo` as PortablePath);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/@foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous scoped files in the prefix path of .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const noDepsEntry = entries.find(entry => entry.startsWith(`no-deps`));
      expect(noDepsEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/@foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/@foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${noDepsEntry}/node_modules/@foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous scoped files in the prefix path of .store entries (self-require-trap)`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `self-require-trap@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const selfRequireTrapEntry = entries.find(entry => entry.startsWith(`self-require-trap-npm-1.0.0`));
      expect(selfRequireTrapEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/self-require-trap/node_modules/self-require-trap` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.mkdirPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/@foo` as PortablePath);
      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/@foo/bar` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${selfRequireTrapEntry}/node_modules/@foo` as PortablePath)).resolves.toStrictEqual(false);
    }));

    it(`should remove extraneous files in scope folders in the prefix path of .store entries`, makeTemporaryEnv({}, {
      nodeLinker: `pnpm`,
    }, async ({path, run, source}) => {
      await run(`add`, `@types/no-deps@1.0.0`);

      // Sanity check
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store` as PortablePath)).resolves.toStrictEqual(true);
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/@types/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      const entries = await lsStore(path);
      const typesNoDepsEntry = entries.find(entry => entry.startsWith(`@types-no-deps`));
      expect(typesNoDepsEntry).toBeDefined();
      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${typesNoDepsEntry}/node_modules/@types/no-deps` as PortablePath)).resolves.toStrictEqual(true);

      await xfs.writeFilePromise(`${path}/${Filename.nodeModules}/.store/${typesNoDepsEntry}/node_modules/@types/foo` as PortablePath, ``);

      await run(`install`);

      await expect(xfs.existsPromise(`${path}/${Filename.nodeModules}/.store/${typesNoDepsEntry}/node_modules/@types/foo` as PortablePath)).resolves.toStrictEqual(false);
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
