import {xfs}           from '@berry/fslib';
import {stringifySyml} from '@berry/parsers';

const PLUGIN_A = `
const factory = () => { console.log('Hello world A'); return {default:{}}; };
const name = '@berry/plugin-a';
module.exports = {factory, name};
`;

const PLUGIN_B = `
const factory = () => { console.log('Hello world B'); return {default:{}}; };
const name = '@berry/plugin-b';
module.exports = {factory, name};
`;

describe(`Features`, () => {
  describe(`Plugins`, () => {
    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
      scripts: {
        nothing: ``,
      },
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js`, PLUGIN_A);

      await xfs.writeFilePromise(`${path}/.yarnrc`, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Hello world A\nHello world A\n`,
      });
    }));

    test(`it should properly load multiple plugins via the local rc file, in the right order`, makeTemporaryEnv({
      scripts: {
        nothing: ``,
      },
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js`, PLUGIN_A);
      await xfs.writeFilePromise(`${path}/plugin-b.js`, PLUGIN_B);

      await xfs.writeFilePromise(`${path}/.yarnrc`, stringifySyml({
        plugins: [`./plugin-a.js`, `./plugin-b.js`],
      }));

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Hello world A\nHello world B\nHello world A\nHello world B\n`,
      });
    }));
  });
});
