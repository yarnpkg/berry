import {PortablePath, xfs} from '@yarnpkg/fslib';
import {stringifySyml}     from '@yarnpkg/parsers';

const PLUGIN = (name: string, {async = false, printOnBoot = false} = {}) => `
const factory = ${async ? `async` : ``} r => {
  const {Command} = r('clipanion');

  if (${printOnBoot})
    console.log('Booting ${name.toUpperCase()}');

  return {
    default: {
      commands: [
        class MyCommand extends Command {
          static paths = [['${name}']];

          async execute() {
            this.context.stdout.write('Executing ${name.toUpperCase()}\\n');
          }
        },
      ],
    },
  };
};

const name = '@yarnpkg/plugin-${name}';
module.exports = {factory, name};
`;

describe(`Features`, () => {
  describe(`Plugins`, () => {
    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`a`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting A\n`,
      });
    }));

    test(`it should accept asynchronous plugins`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`a`, {async: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`a`)).resolves.toMatchObject({
        stdout: `Executing A\n`,
      });
    }));

    test(`it should properly load a plugin via the local rc file`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`A`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting A\n`,
      });
    }));

    test(`it should properly load multiple plugins via the local rc file, in the right order`, makeTemporaryEnv({
    }, async ({path, run, source}) => {
      await xfs.writeFilePromise(`${path}/plugin-a.js` as PortablePath, PLUGIN(`A`, {printOnBoot: true}));
      await xfs.writeFilePromise(`${path}/plugin-b.js` as PortablePath, PLUGIN(`B`, {printOnBoot: true}));

      await xfs.writeFilePromise(`${path}/.yarnrc.yml` as PortablePath, stringifySyml({
        plugins: [`./plugin-a.js`, `./plugin-b.js`],
      }));

      await run(`install`);

      await expect(run(`node`, `-e`, ``)).resolves.toMatchObject({
        stdout: `Booting A\nBooting B\nBooting A\nBooting B\n`,
      });
    }));
  });
});
