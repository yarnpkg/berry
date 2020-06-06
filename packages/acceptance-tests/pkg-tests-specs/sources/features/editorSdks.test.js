import {npath, ppath, xfs}   from '@yarnpkg/fslib';
import JSONStream            from 'JSONStream';
import {execFileSync, spawn} from 'child_process';
import {StringDecoder}       from 'string_decoder';

describe(`Features`, () => {
  describe(`Editor SDK`, () => {
    test(
      `it should allow non-PnP Node to access the binary under a PnP environment`,
      makeTemporaryEnv({
        dependencies: {
          [`eslint`]: `file:./my-eslint`,
        },
      }, async ({path, run, source}) => {
        const binPath = ppath.join(path, `my-eslint/bin/eslint.js`);
        const manifestPath = ppath.join(path, `my-eslint/package.json`);

        await xfs.mkdirpPromise(ppath.dirname(binPath));
        await xfs.writeFilePromise(binPath, `console.log(JSON.stringify({wrapper: require('no-deps')}))`);

        await xfs.mkdirpPromise(ppath.dirname(manifestPath));
        await xfs.writeJsonPromise(manifestPath, {
          name: `eslint`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await run(`install`);
        await pnpify([`--sdk`], path);

        const rawOutput = await noPnpNode([`./.vscode/pnpify/eslint/bin/eslint.js`], path);
        const jsonOutput = JSON.parse(rawOutput);

        expect(jsonOutput).toMatchObject({
          wrapper: {
            name: `no-deps`,
            version: `1.0.0`,
          },
        });
      }),
    );

    test(
      `it shouldn't break under non-PnP installs`,
      makeTemporaryEnv({
        dependencies: {
          [`eslint`]: `file:./my-eslint`,
        },
      }, async ({path, run, source}) => {
        const binPath = ppath.join(path, `my-eslint/bin/eslint.js`);
        const manifestPath = ppath.join(path, `my-eslint/package.json`);

        await xfs.mkdirpPromise(ppath.dirname(binPath));
        await xfs.writeFilePromise(binPath, `console.log(JSON.stringify({wrapper: require('no-deps')}))`);

        await xfs.mkdirpPromise(ppath.dirname(manifestPath));
        await xfs.writeJsonPromise(manifestPath, {
          name: `eslint`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: `1.0.0`,
          },
        });

        await run(`install`);
        await pnpify([`--sdk`], path);

        await run(`install`, {nodeLinker: `node-modules`});
        expect(xfs.existsSync(ppath.join(path, `.pnp.js`))).toEqual(false);

        const rawOutput = await noPnpNode([`./.vscode/pnpify/eslint/bin/eslint.js`], path);
        const jsonOutput = JSON.parse(rawOutput);

        expect(jsonOutput).toMatchObject({
          wrapper: {
            name: `no-deps`,
            version: `1.0.0`,
          },
        });
      }),
    );

    /**
     * Example messages matching '/\.zip\\//' within "send(msg)" - https://hastebin.com/zosibaseki
     * Note that no messages were found matching '/^zip:\\/\\//' were found within "onMessage(message)"
     */
    test(
      `it should patch message into VSCode typescript language extension for zip schemes`,
      async () => {
        const child = spawn(process.execPath, [require.resolve(`@yarnpkg/monorepo/.vscode/pnpify/typescript/lib/tsserver.js`)], {
          cwd: npath.dirname(require.resolve(`@yarnpkg/monorepo/package.json`)),
          stdio: `pipe`,
          encoding: `utf8`,
        });

        const watchFor = async marker => {
          let data = ``;
          let timeout = null;

          return await Promise.race([
            new Promise(resolve => {
              child.stdout.on(`data`, chunk => {
                data += chunk;
                if (data.includes(marker)) {
                  clearTimeout(timeout);
                  resolve(true);
                }
              });
            }),
            new Promise((resolve, reject) => {
              timeout = setTimeout(() => {
                reject(new Error(`Timeout reached; server answered:\n\n${data}`));
              }, 10000);
            }),
          ]);
        };

        try {
          // We get the path to something that's definitely in a zip archive
          const lodashTypeDef = require.resolve(`@types/lodash/index.d.ts`).replace(/\\/g, `/`);

          // We'll also use this file (which we control, so its content won't
          // change) to get autocompletion infos. It depends on lodash too.
          const ourUtilityFile = require.resolve(`./editorSdks.utility.ts`).replace(/\\/g, `/`);

          // Some sanity check to make sure everything is A-OK
          expect(lodashTypeDef).toContain(`.zip`);

          const openPromise = expect(watchFor(`projectLoadingFinish`)).resolves.toEqual(true);

          child.stdin.write(`${JSON.stringify({
            seq: 0,
            type: `request`,
            command: `open`,
            arguments: {file: `zip://${lodashTypeDef}`},
          })}\n`);

          await openPromise;

          // "On windows platform, there must be a slash just after the ':' e.g. zip:/e:/prj/.yarn/cache/pack.zip/node_modules/....
          // else the function 'isAbsolutePath' from resources.ts that is called in fileService.ts will return false"
          // https://github.com/yarnpkg/berry/pull/1165/files#r408243689
          const prefix = process.arch === `win32` ? `/` : ``;

          const typeDefPromise = expect(watchFor(`zip:${prefix}${lodashTypeDef}`)).resolves.toEqual(true);

          child.stdin.write(`${JSON.stringify({
            seq: 1,
            type: `request`,
            command: `typeDefinition`,
            arguments: {file: ourUtilityFile, line: 6, offset: 9},
          })}\n`);

          await typeDefPromise;
        } finally {
          child.stdin.end();
        }
      }
    );
  });
});

const noPnpNode = async (args, cwd) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...args], {
      cwd: npath.fromPortablePath(cwd),
      stdio: [`ignore`, `pipe`, `inherit`],
      env: {
        ...process.env,
        NODE_OPTIONS: undefined,
      },
    });

    child.on(`error`, error => {
      reject(error);
    });

    const stdout = [];

    child.stdout.on(`data`, chunk => {
      stdout.push(chunk);
    });

    child.on(`close`, code => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString());
      } else {
        reject(new Error(`Process exited with status code ${code}`));
      }
    });
  });
};

const pnpify = async (args, cwd) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npath.join(__dirname, `../../../../yarnpkg-pnpify/sources/boot-cli-dev.js`), ...args], {
      cwd: npath.fromPortablePath(cwd),
      stdio: `ignore`,
    });

    child.on(`error`, error => {
      reject(error);
    });

    child.on(`close`, code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with status code ${code}`));
      }
    });
  });
};
