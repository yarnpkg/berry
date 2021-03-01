import {xfs} from '@yarnpkg/fslib';

describe(`Commands`, () => {
  const config = {
    plugins: [
      require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
    ],
  };

  const manifest = {
    workspaces: [
      `packages/*`,
    ],
    dependencies: {
      'is-number': `1.0.0`,
    },
    license: `MIT`,
    scripts: {
      echo: `echo`,
    },
    unparsedKey: `foo`,
  };

  describe(`constraints --fix`, () => {
    test(`test apply fix to dependencies`, makeTemporaryEnv(manifest, config, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
      gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
      `);

      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`2.0.0`);
      expect(fixedManifest.license).toBe(`MIT`);
    }));

    test(`test apply fix to fields`, makeTemporaryEnv(manifest, config, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
      gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`1.0.0`);
      expect(fixedManifest.license).toBe(`BSD-2-Clause`);
    }));

    test(`test apply fix to fields and manifests`, makeTemporaryEnv(manifest, config, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
      gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
      gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`2.0.0`);
      expect(fixedManifest.license).toBe(`BSD-2-Clause`);
    }));

    test(`test applying fix shouldn't duplicate workspaces`, makeTemporaryEnv(manifest, config, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
      gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
      gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.workspaces.length).toBe(1);
    }));

    it(`should preserve the raw manifest data when applying a fix`, makeTemporaryEnv(manifest, config, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
      gen_enforced_dependency('.', 'is-number', null, dependencies).
      `);

      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.scripts).toMatchObject({echo: `echo`});
      expect(fixedManifest.unparsedKey).toBe(`foo`);
    }));
  });
});
