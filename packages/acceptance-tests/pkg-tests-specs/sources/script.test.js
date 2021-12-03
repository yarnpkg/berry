const {npath, ppath, xfs} = require(`@yarnpkg/fslib`);
const {isAbsolute, resolve} = require(`path`);

const {
  fs: {createTemporaryFolder, makeFakeBinary, walk, readFile, writeJson, writeFile},
} = require(`pkg-tests-core`);

const globalName = makeTemporaryEnv.getPackageManagerName();

const configs = [{
  nodeLinker: `pnp`,
}, {
  nodeLinker: `pnpm`,
}, {
  nodeLinker: `node-modules`,
}];

describe(`Scripts tests`, () => {
  test(
    `it should run scripts using the same Node than the one used by Yarn`,
    makeTemporaryEnv({scripts: {myScript: `node --version`}}, async ({path, run, source}) => {
      await run(`install`);

      await makeFakeBinary(`${path}/bin/node`, {exitCode: 0});

      await expect(run(`run`, `myScript`)).resolves.not.toMatchObject({stdout: `Fake binary`});
    }),
  );

  test(
    `it should run scripts using the same package manager than the one running the scripts`,
    makeTemporaryEnv({scripts: {myScript: `${globalName} --version`}}, async ({path, run, source}) => {
      await run(`install`);

      await makeFakeBinary(`${path}/bin/${globalName}`, {exitCode: 0});

      await expect(run(`run`, `myScript`)).resolves.not.toMatchObject({stdout: `Fake binary`});
    }),
  );

  test(
    `it should run declared scripts`,
    makeTemporaryEnv(
      {
        scripts: {
          [`foobar`]: `echo test successful`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(run(`run`, `foobar`)).resolves.toMatchObject({
          stdout: `test successful\n`,
        });
      },
    ),
  );

  test(
    `it should correctly run empty install scripts`,
    makeTemporaryEnv({dependencies: {[`no-deps-scripted-empty`]: `1.0.0`}}, async ({path, run, source}) => {
      await run(`install`);
    }),
  );

  test(
    `it should set INIT_CWD`,
    makeTemporaryEnv({
      private: true,
      workspaces: [`packages/*`],
    }, async ({path, run, source}) => {
      await xfs.mkdirpPromise(`${path}/packages/test`);

      await xfs.writeJsonPromise(`${path}/packages/test/package.json`, {
        scripts: {
          [`test:script`]: `echo "$INIT_CWD"`,
        },
      });

      await run(`install`);

      await expect(run(`run`, `test:script`)).resolves.toMatchObject({
        stdout: `${npath.fromPortablePath(path)}\n`,
      });

      await expect(run(`run`, `test:script`, {
        cwd: `${path}/packages`,
      })).resolves.toMatchObject({
        stdout: `${npath.fromPortablePath(`${path}/packages`)}\n`,
      });
    }),
  );

  test(
    `it should set PROJECT_CWD`,
    makeTemporaryEnv({
      private: true,
      workspaces: [`packages/*`],
    }, async ({path, run, source}) => {
      await xfs.mkdirpPromise(`${path}/packages/test`);

      await xfs.writeJsonPromise(`${path}/packages/test/package.json`, {
        scripts: {
          [`test:script`]: `echo "$PROJECT_CWD"`,
        },
      });

      await run(`install`);

      await expect(run(`run`, `test:script`)).resolves.toMatchObject({
        stdout: `${npath.fromPortablePath(path)}\n`,
      });

      await expect(run(`run`, `test:script`, {
        cwd: `${path}/packages`,
      })).resolves.toMatchObject({
        stdout: `${npath.fromPortablePath(path)}\n`,
      });
    }),
  );

  test(
    `it should correctly run scripts when project path has space inside`,
    makeTemporaryEnv({
      private: true,
      workspaces: [`packages/*`],
    }, async ({path, run, source}) => {
      await writeJson(`${path}/packages/test 1/package.json`, {
        scripts: {
          [`ws:foo2`]: `yarn run ws:foo`,
          [`ws:foo`]: `node -e 'console.log(1)'`,
        },
      });

      await run(`install`);

      await expect(run(`run`, `ws:foo2`)).resolves.toMatchObject({
        stdout: `1\n`,
      });
    }),
  );

  test(
    `it should make expose some basic information via the environment`,
    makeTemporaryEnv({
      name: `helloworld`,
      version: `1.2.3`,
      scripts: {
        [`test`]: `node -p 'JSON.stringify(process.env)'`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      const {stdout} = await run(`run`, `test`);
      const env = JSON.parse(stdout);

      expect(env).toMatchObject({
        npm_package_name: `helloworld`,
        npm_package_version: `1.2.3`,
      });
    }),
  );

  test(
    `it should setup the correct path for locally installed binaries`,
    makeTemporaryEnv({
      scripts: {
        [`test`]: `node test`,
      },
      dependencies: {
        [`has-bin-entries`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      await writeFile(`${path}/test.js`, `
      const {existsSync} = require('fs');
      const {join} = require('path');

      const files = ['has-bin-entries'];
      if (process.platform === 'win32')
        files.push('has-bin-entries.cmd');

      for (const file of files) {
        if (!existsSync(join(process.env.BERRY_BIN_FOLDER, file))) {
          console.error('Expected ' + file + ' to exist');
          process.exit(1);
        }
      }

      console.log('ok');
      `);

      await expect(run(`test`)).resolves.toMatchObject({
        stdout: `ok\n`,
      });
    }),
  );

  test(
    `it should be able to spawn binaries with a utf-8 path`,
    makeTemporaryEnv(
      {
        name: `testbin`,
        bin: `å.js`,
        scripts: {
          [`test`]: `testbin`,
        },
      },
      async ({path, run, source}) => {
        await xfs.writeFilePromise(`${path}/å.js`, `console.log('ok')`);
        await run(`install`);

        await expect(run(`test`)).resolves.toMatchObject({
          stdout: `ok\n`,
        });
      },
    ),
  );

  test(
    `it should allow to execute the dependencies binaries even from a different cwd than the project root`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`has-bin-entries`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        await run(`install`);

        await xfs.mkdirpPromise(`${path}/foo/bar`);

        await expect(
          run(`run`, `has-bin-entries`, `success`, {
            cwd: `${path}/foo/bar`,
          }),
        ).resolves.toMatchObject({
          stdout: `success\n`,
        });
      },
    ),
  );

  for (const config of configs) {
    describe(`w/ the ${config.nodeLinker} linker`, () => {
      test(
        `it should allow to retrieve the path to a dependency binary by its name`,
        makeTemporaryEnv(
          {
            dependencies: {
              [`has-bin-entries`]: `1.0.0`,
            },
          },
          async ({path, run, source}) => {
            await run(`install`);

            const {stdout} = await run(`bin`, `has-bin-entries`);

            expect(stdout.trim()).not.toEqual(``);
            await expect(
              source(`require('fs').existsSync(${JSON.stringify(resolve(path, stdout.trim()))})`),
            ).resolves.toEqual(true);
          },
        ),
      );

      test(
        `it should return an absolute path when retrieving the path to a dependency binary`,
        makeTemporaryEnv(
          {
            dependencies: {
              [`has-bin-entries`]: `1.0.0`,
            },
          },
          async ({path, run, source}) => {
            await run(`install`);

            const {stdout} = await run(`bin`, `has-bin-entries`);

            expect(isAbsolute(stdout.trim())).toEqual(true);
          },
        ),
      );

      test(
        `it should allow to retrieve the path to a dependency binary, even when running from outside the project`,
        makeTemporaryEnv(
          {
            dependencies: {[`has-bin-entries`]: `1.0.0`},
          },
          async ({path, run, source}) => {
            await run(`install`);

            const tmp = await createTemporaryFolder();

            const {stdout} = await run(`bin`, `has-bin-entries`, {
              projectFolder: path,
              cwd: tmp,
            });

            expect(stdout.trim()).not.toEqual(``);
            await expect(
              source(`require('fs').existsSync(${JSON.stringify(resolve(path, stdout.trim()))})`),
            ).resolves.toEqual(true);
          },
        ),
      );

      test(
        `it should allow dependency binaries to require their own dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {
              [`has-bin-entries`]: `1.0.0`,
            },
          },
          async ({path, run, source}) => {
            await run(`install`);

            await expect(run(`run`, `has-bin-entries-with-require`)).resolves.toMatchObject({
              stdout: `no-deps\n1.0.0\n`,
            });
          },
        ),
      );

      test(
        `it should allow dependency binaries to require relative paths`,
        makeTemporaryEnv({dependencies: {[`has-bin-entries`]: `1.0.0`}}, async ({path, run, source}) => {
          await run(`install`);

          await expect(run(`run`, `has-bin-entries-with-relative-require`)).resolves.toMatchObject({
            stdout: `1.0.0\n`,
          });
        }),
      );

      test(
        `it should run install scripts during the install`,
        makeTemporaryEnv({dependencies: {[`no-deps-scripted`]: `1.0.0`}}, async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-scripted/log.js')`)).resolves.toEqual([
            `preinstall`,
            `install`,
            `postinstall`,
          ]);
        }),
      );

      test(
        `it should trigger the postinstall scripts in the right order, children before parents`,
        makeTemporaryEnv({
          private: true,
          workspaces: [
            `child`,
          ],
          dependencies: {
            [`child`]: `workspace:*`,
          },
          scripts: {
            [`install`]: `echo 'module.exports.push("root");' >> log.js`,
          },
        }, async ({path, run, source}) => {
          await xfs.mkdirPromise(ppath.join(path, `child`));
          await xfs.writeJsonPromise(ppath.join(path, `child/package.json`), {
            name: `child`,
            scripts: {
              [`install`]: `echo 'module.exports.push("child");' >> ../log.js`,
            },
          });

          await xfs.writeFilePromise(ppath.join(path, `log.js`), `module.exports = [];\n`);
          await run(`install`);

          await expect(source(`require("./log")`)).resolves.toEqual([
            `child`,
            `root`,
          ]);
        }),
      );

      test(
        `it should trigger the postinstall when a dependency gets its dependency tree modified`,
        makeTemporaryEnv({
          private: true,
          workspaces: [
            `child`,
          ],
          dependencies: {
            [`child`]: `workspace:*`,
          },
          scripts: {
            [`install`]: `echo 'module.exports.push("root");' >> log.js`,
          },
        }, async ({path, run, source}) => {
          await xfs.mkdirPromise(ppath.join(path, `child`), {recursive: true});
          await xfs.writeJsonPromise(ppath.join(path, `child/package.json`), {
            name: `child`,
            scripts: {
              postinstall: `echo 'module.exports.push("child");' >> ../log.js`,
            },
          });

          await run(`install`);
          await xfs.writeFilePromise(ppath.join(path, `log.js`), `module.exports = [];\n`);

          await run(`./child`, `add`, `no-deps@1.0.0`);

          await expect(source(`require('./log')`)).resolves.toEqual([
            `child`,
            `root`,
          ]);
        }),
      );

      test(
        `it shouldn't trigger the postinstall if an unrelated branch of the tree is modified`,
        makeTemporaryEnv({
          private: true,
          workspaces: [
            `packages/*`,
          ],
          dependencies: {
            [`first`]: `workspace:*`,
          },
          scripts: {
            [`install`]: `echo 'module.exports.push("root");' >> log.js`,
          },
        }, async ({path, run, source}) => {
          await xfs.mkdirPromise(ppath.join(path, `packages/first`), {recursive: true});
          await xfs.mkdirPromise(ppath.join(path, `packages/second`), {recursive: true});

          await xfs.writeJsonPromise(ppath.join(path, `packages/first/package.json`), {
            name: `first`,
          });

          await xfs.writeJsonPromise(ppath.join(path, `packages/second/package.json`), {
            name: `bar`,
          });

          await run(`install`);
          await xfs.writeFilePromise(ppath.join(path, `log.js`), `module.exports = [];`);

          await run(`packages/second`, `add`, `no-deps@1.0.0`);

          await expect(source(`require('./log')`)).resolves.toEqual([
            // Must be empty, since the postinstall script shouldn't have run
          ]);
        }),
      );

      test(
        `it should abort with an error if a package can't be built`,
        makeTemporaryEnv({dependencies: {[`no-deps-scripted-to-fail`]: `1.0.0`}}, async ({path, run, source}) => {
          await expect(run(`install`)).rejects.toThrow();
        }),
      );

      test(
        `it shouldn't abort with an error if the package that can't be built is optional`,
        makeTemporaryEnv({optionalDependencies: {[`no-deps-scripted-to-fail`]: `1.0.0`}}, async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-scripted-to-fail')`)).resolves.toMatchObject({
            name: `no-deps-scripted-to-fail`,
            version: `1.0.0`,
          });
        }),
      );

      test(
        `it shouldn't abort with an error if the package that can't be built is a transitive dependency of an optional package`,
        makeTemporaryEnv({optionalDependencies: {[`no-deps-scripted-to-deeply-fail`]: `1.0.0`}}, async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-scripted-to-deeply-fail')`)).resolves.toMatchObject({
            name: `no-deps-scripted-to-deeply-fail`,
            version: `1.0.0`,
            dependencies: {
              [`no-deps-scripted-to-fail`]: {
                name: `no-deps-scripted-to-fail`,
                version: `1.0.0`,
              },
            },
          });
        }),
      );

      test(
        `it should allow dependencies with install scripts to run the binaries exposed by their own dependencies`,
        makeTemporaryEnv(
          {
            dependencies: {[`one-dep-scripted`]: `1.0.0`},
          },
          async ({path, run, source}) => {
            await run(`install`);
          },
        ),
      );

      test(
        `it should allow dependencies with install scripts to run their own subscripts`,
        makeTemporaryEnv(
          {
            dependencies: {[`no-deps-nested-postinstall`]: `1.0.0`},
          },
          async ({path, run, source}) => {
            await run(`install`);
          },
        ),
      );

      test(
        `it should add node-gyp rebuild script if there isn't an install script and there is a binding.gyp file`,
        makeTemporaryEnv(
          {
            dependencies: {[`binding-gyp-scripts`]: `1.0.0`},
          },
          async ({path, run, source}) => {
            await run(`install`, {env: {}});

            const [itemPath] = await walk(`${path}/.yarn/unplugged/`, {filter: `/binding-gyp-scripts-*/node_modules/binding-gyp-scripts/build.node`});

            expect(itemPath).toBeDefined();

            const content = await readFile(itemPath, `utf8`);
            await expect(content).toEqual(npath.fromPortablePath(itemPath));
          },
        ),
      );

      test(
        `it shouldn't call the postinstall on every install`,
        makeTemporaryEnv({
          dependencies: {
            [`no-deps-scripted`]: `1.0.0`,
          },
        }, async ({path, run, source}) => {
          await run(`install`);

          await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
            `preinstall`,
            `install`,
            `postinstall`,
          ]);

          await run(`install`);

          await expect(source(`require('no-deps-scripted/log')`)).resolves.toEqual([
            `preinstall`,
            `install`,
            `postinstall`,
          ]);
        }),
      );

      test(
        `it should run the bin of self-require-trap`,
        makeTemporaryEnv(
          {
            dependencies: {[`self-require-trap`]: `1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(run(`run`, `self-require-trap`)).resolves.toMatchObject({
              code: 0,
              stdout: `42\n`,
              stderr: ``,
            });
          },
        ),
      );

      test(
        `it should run the bin of self-require-trap (aliased)`,
        makeTemporaryEnv(
          {
            dependencies: {[`aliased`]: `npm:self-require-trap@1.0.0`},
          },
          config,
          async ({path, run, source}) => {
            await run(`install`);

            await expect(run(`run`, `self-require-trap`)).resolves.toMatchObject({
              code: 0,
              stdout: `42\n`,
              stderr: ``,
            });
          },
        ),
      );

      test(
        `it should run the bin of a soft-link`,
        makeTemporaryEnv(
          {
            dependencies: {[`soft-link`]: `portal:./soft-link`},
          },
          config,
          async ({path, run, source}) => {
            await xfs.mkdirPromise(`${path}/soft-link`);
            await xfs.writeJsonPromise(`${path}/soft-link/package.json`, {
              name: `soft-link`,
              version: `1.0.0`,
              bin: `./bin`,
            });
            await xfs.writeFilePromise(`${path}/soft-link/bin.js`, `console.log(42);\n`);

            await run(`install`);

            await expect(run(`run`, `soft-link`)).resolves.toMatchObject({
              code: 0,
              stdout: `42\n`,
              stderr: ``,
            });
          },
        ),
      );
    });
  }
});
