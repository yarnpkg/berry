import {xfs} from '@yarnpkg/fslib';

describe(`Protocols`, () => {
  describe(`exec:`, () => {
    test(
      `it should execute a script to generate the package content`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, {
        enableScripts: true,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 42;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(42);
      }),
    );

    test(
      `it should respect \`enableScripts\``,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, {
        enableScripts: false,
      }, async ({path, run}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 42;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await expect(run(`install`)).rejects.toThrow(/all scripts have been disabled/);
      }),
    );

    test(
      `it should allow \`exec:\` when explicitly enabled via \`dependenciesMeta[].built\``,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
        dependenciesMeta: {
          [`dynamic-pkg`]: {
            built: true,
          },
        },
      }, {
        enableScripts: false,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 42;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(42);
      }),
    );

    test(
      `it should prevent non-workspaces from depending on \`exec:\` packages`,
      makeTemporaryEnv({
        dependencies: {
          [`wrapper`]: `file:./wrapper`,
        },
      }, {
        enableScripts: true,
      }, async ({path, run}) => {
        await xfs.mkdirPromise(`${path}/wrapper`);

        await xfs.writeFilePromise(`${path}/wrapper/package.json`, JSON.stringify({
          name: `wrapper`,
          version: `1.0.0`,
          dependencies: {
            [`dynamic-pkg`]: `exec:./genpkg.js`,
          },
        }));

        await xfs.writeFilePromise(`${path}/wrapper/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 42;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await expect(run(`install`)).rejects.toThrow(/only workspaces can depend on exec: packages/);
      }),
    );

    test(
      `it should correctly inject the built-in modules as global variables`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, {
        enableScripts: true,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), \`module.exports = \${JSON.stringify(Object.getOwnPropertyNames(global))};\`);
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(
          expect.arrayContaining(
            require(`module`).builtinModules.filter(name => name !== `module` && !name.startsWith(`_`)).concat([`Module`]),
          ),
        );
      }),
    );

    test(
      `it should correctly inject the \`execEnv\` global variable`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, {
        enableScripts: true,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), \`module.exports = \${JSON.stringify(execEnv)};\`);
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toMatchObject({
          tempDir: expect.any(String),
          buildDir: expect.any(String),
          locator: expect.any(String),
        });
      }),
    );

    test(
      `it should update the cache`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, {
        enableScripts: true,
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 42;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), 'module.exports = 100;');
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(100);
      }),
    );
  });
});
