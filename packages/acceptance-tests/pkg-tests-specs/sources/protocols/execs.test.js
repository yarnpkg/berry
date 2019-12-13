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
