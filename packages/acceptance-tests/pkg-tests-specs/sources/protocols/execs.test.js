import {xfs}           from '@yarnpkg/fslib';
import {stringifySyml} from '@yarnpkg/parsers';

describe(`Protocols`, () => {
  describe(`exec:`, () => {
    test(
      `it should execute a script to generate the package content`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, stringifySyml({
          plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-exec.js`)],
        }));

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
      `it should correctly inject the built-in modules as global variables`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, stringifySyml({
          plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-exec.js`)],
        }));

        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const {buildDir} = execEnv;
          fs.writeFileSync(path.join(buildDir, 'index.js'), \`module.exports = \${JSON.stringify(Object.getOwnPropertyNames(global))};\`);
          fs.writeFileSync(path.join(buildDir, 'package.json'), '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(
          expect.arrayContaining(
            require(`module`).builtinModules.filter(name => name !== `module` && !name.startsWith(`_`)).concat([`Module`]),
          )
        );
      }),
    );

    test(
      `it should correctly inject the \`execEnv\` global variable`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, stringifySyml({
          plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-exec.js`)],
        }));

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
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc.yml`, stringifySyml({
          plugins: [require.resolve(`@yarnpkg/monorepo/scripts/plugin-exec.js`)],
        }));

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
