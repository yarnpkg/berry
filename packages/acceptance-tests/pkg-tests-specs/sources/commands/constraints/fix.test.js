import {Filename, ppath, xfs} from '@yarnpkg/fslib';

import {environments}         from './environments';

describe(`Commands`, () => {
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
    it(`shouldn't crash due to an unending fix loop`, makeTemporaryEnv({
      foo: ``,
    }, async ({path, run, source}) => {
      await run(`install`);

      await xfs.writeFilePromise(ppath.join(path, `yarn.config.cjs`), `
        exports.constraints = ({Yarn}) => {
          for (const w of Yarn.workspaces()) {
            w.set(['foo'], \`\${w.manifest.foo}x\`);
          }
        };
      `);

      await run(`constraints`, `--fix`, {
        execArgv: [
          `--require`, require.resolve(`@yarnpkg/monorepo/.pnp.cjs`),
          `--require`, require.resolve(`@yarnpkg/monorepo/scripts/setup-ts-execution`),
          `--require`, require.resolve(`@yarnpkg/monorepo/scripts/detect-unsafe-writes.ts`),
        ],
      });

      await expect(xfs.readJsonPromise(ppath.join(path, Filename.manifest))).resolves.toMatchObject({
        foo: `xxxxxxxxxx`,
      });
    }));

    test(`test apply fix to dependencies`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`2.0.0`);
      expect(fixedManifest.license).toBe(`MIT`);
    }));

    test(`test apply fix to fields`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`1.0.0`);
      expect(fixedManifest.license).toBe(`BSD-2-Clause`);
    }));

    test(`test apply fix to fields and manifests`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
        gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.dependencies[`is-number`]).toBe(`2.0.0`);
      expect(fixedManifest.license).toBe(`BSD-2-Clause`);
    }));

    test(`test applying fix shouldn't duplicate workspaces`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_dependency('.', 'is-number', '2.0.0', dependencies).
        gen_enforced_field('.', 'license', 'BSD-2-Clause').
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.workspaces.length).toBe(1);
    }));

    it(`should preserve the raw manifest data when applying a fix`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_dependency('.', 'is-number', null, dependencies).
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest.scripts).toMatchObject({echo: `echo`});
      expect(fixedManifest.unparsedKey).toBe(`foo`);
    }));

    test(`test apply fix to string fields`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await environments[`various field types`](path);

      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_field(WorkspaceCwd, '_name', FieldValue) :- workspace_field(WorkspaceCwd, 'name', FieldValue).
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest._name).toStrictEqual(`foo`);
    }));

    test(`test apply fix to object fields`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await environments[`various field types`](path);

      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_field(WorkspaceCwd, '_repository', FieldValue) :- workspace_field(WorkspaceCwd, 'repository', FieldValue).
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest._repository).toStrictEqual({
        type: `git`,
        url: `ssh://git@github.com/yarnpkg/berry.git`,
        directory: `.`,
      });
    }));

    test(`test apply fix to array fields`, makeTemporaryEnv(manifest, async ({path, run, source}) => {
      await environments[`various field types`](path);

      await xfs.writeFilePromise(`${path}/constraints.pro`, `
        gen_enforced_field(WorkspaceCwd, '_files', FieldValue) :- workspace_field(WorkspaceCwd, 'files', FieldValue).
      `);

      await run(`install`);
      await run(`constraints`, `--fix`);

      const fixedManifest = await xfs.readJsonPromise(`${path}/package.json`);

      expect(fixedManifest._files).toStrictEqual([
        `/a`,
        `/b`,
        `/c`,
      ]);
    }));
  });
});
