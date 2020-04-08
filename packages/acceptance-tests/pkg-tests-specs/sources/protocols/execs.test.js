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
          fs.mkdirSync('build');
          fs.writeFileSync('build/index.js', 'module.exports = 42;');
          fs.writeFileSync('build/package.json', '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(42);
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
          fs.mkdirSync('build');
          fs.writeFileSync('build/index.js', \`module.exports = \${JSON.stringify(execEnv)};\`);
          fs.writeFileSync('build/package.json', '{}');
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
          fs.mkdirSync('build');
          fs.writeFileSync('build/index.js', 'module.exports = 42;');
          fs.writeFileSync('build/package.json', '{}');
        `);

        await run(`install`);

        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          fs.mkdirSync('build');
          fs.writeFileSync('build/index.js', 'module.exports = 100;');
          fs.writeFileSync('build/package.json', '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(100);
      }),
    );
  });
});
