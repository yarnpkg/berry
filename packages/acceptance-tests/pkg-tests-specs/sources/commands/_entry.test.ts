import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';

const PLUGIN_ENSURE_CWD = `
  module.exports = {
    name: 'plugin-ensure-cwd',
    factory: require => {
      const {Command} = require('clipanion');
      const {BaseCommand} = require('@yarnpkg/cli');
      const {Configuration} = require('@yarnpkg/core');

      class EnsureCwdCommand extends BaseCommand {
        static paths = [['ensure-cwd']];

        async execute() {
          const {plugins} = await Configuration.find(this.context.cwd, this.context.plugins);
          for (const {commands} of plugins.values()) {
            if (commands) {
              for (const commandClass of commands) {
                const {cwd} = new commandClass();
                if (typeof cwd !== 'object' || cwd === null || !cwd[Command.isOption]) {
                  const path = (commandClass.paths ?? [])[0].join(' ');
                  throw new Error(\`\${path} doesn't declare a --cwd option\`);
                }
              }
            }
          }
        }
      }

      return {
        commands: [
          EnsureCwdCommand,
        ],
      };
    }
  };
`;

describe(`Entry`, () => {
  describe(`--version`, () => {
    test(
      `it should print the version from the package.json when given --version`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`--version`);
        expect(stdout.trim()).toEqual(`0.0.0`);
      }),
    );

    test(
      `it should print the version from the package.json when given -v`,
      makeTemporaryEnv({}, async ({path, run, source}) => {
        const {stdout} = await run(`-v`);
        expect(stdout.trim()).toEqual(`0.0.0`);
      }),
    );
  });

  describe(`--cwd`, () => {
    test(`all commands must support the --cwd flag`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await xfs.writeFilePromise(ppath.join(path, `plugin-ensure-cwd.cjs`), PLUGIN_ENSURE_CWD);
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        plugins: [`./plugin-ensure-cwd.cjs`],
      });

      await run(`ensure-cwd`);
    }));

    test(`should use the specified --cwd (relative path)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`--cwd`, `packages`, `exec`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
    }));

    test(`should use the specified --cwd (absolute path)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await makeTemporaryEnv({}, async ({path: path2}) => {
        await expect(run(`--cwd`, npath.fromPortablePath(path2), `exec`, `pwd`)).resolves.toMatchObject({
          stdout: `${path2}\n`,
        });
      });
    }));

    test(`should use the specified --cwd (multiple positions)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`--cwd`, `packages`, `exec`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
      await expect(run(`exec`, `--cwd`, `packages`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
    }));

    test(`should use the specified --cwd (bound option)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`exec`, `--cwd=packages`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
    }));

    test(`should use the specified --cwd (repeated option)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`--cwd=modules`, `exec`, `--cwd=packages`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
    }));

    test(`should use the specified --cwd (composed with leading folder argument)`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`./foo`, `--cwd=bar`, `exec`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/foo/bar\n`,
      });
      await expect(run(`--cwd=bar`, `./foo`, `exec`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/bar/foo\n`,
      });
      await expect(run(`--cwd=bar`, `./foo`, `exec`, `--cwd=baz`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/bar/foo/baz\n`,
      });
    }));

    test(`should use the specified --cwd (composed with yarn workspace)`, makeTemporaryMonorepoEnv({
      workspaces: [`foo`],
    }, {
      foo: {},
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`workspace`, `foo`, `exec`, `--cwd=bar`, `pwd`)).resolves.toMatchObject({
        stdout: `${path}/foo/bar\n`,
      });
    }));

    test(`should use the specified --cwd (composed with yarn workspaces foreach)`, makeTemporaryMonorepoEnv({
      workspaces: [`foo`, `bar`, `baz`],
    }, {
      foo: {},
      bar: {},
      baz: {},
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`workspaces`, `foreach`, `exec`, `--cwd=qux`, `pwd`)).resolves.toMatchObject({
        stdout: [
          `${path}/qux`,
          `${path}/bar/qux`,
          `${path}/baz/qux`,
          `${path}/foo/qux`,
          `Done\n`,
        ].join(`\n`),
      });
    }));

    test(`should use the specified --cwd (inside script)`, makeTemporaryEnv({
      scripts: {
        foo: `yarn --cwd=packages exec pwd`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      await expect(run(`run`, `foo`)).resolves.toMatchObject({
        stdout: `${path}/packages\n`,
      });
    }));
  });
});
