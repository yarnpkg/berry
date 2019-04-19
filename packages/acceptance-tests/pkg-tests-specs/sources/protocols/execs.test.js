import {xfs}           from '@berry/fslib';
import {stringifySyml} from '@berry/parsers';

const {
  fs: {readJson, writeJson},
  tests: {getPackageDirectoryPath},
} = require('pkg-tests-core');

describe(`Protocols`, () => {
  describe(`exec:`, () => {
    test(
      `it should execute a script to generate the package content`,
      makeTemporaryEnv({
        dependencies: {
          [`dynamic-pkg`]: `exec:./genpkg.js`,
        },
      }, async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/.yarnrc`, stringifySyml({
          plugins: [require.resolve(`@berry/monorepo/scripts/plugin-exec.js`)],
        }));
  
        await xfs.writeFilePromise(`${path}/genpkg.js`, `
          const fs = require('fs');
          fs.mkdirSync('build');
          fs.writeFileSync('build/index.js', 'module.exports = 42;');
          fs.writeFileSync('build/package.json', '{}');
        `);

        await run(`install`);

        await expect(source(`require('dynamic-pkg')`)).resolves.toEqual(42);
      }),
    );
  });
});
