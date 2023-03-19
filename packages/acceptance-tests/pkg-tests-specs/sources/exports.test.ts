import {NativePath, npath, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import {yarn}                                        from 'pkg-tests-core';

export type Manifest = {
  name: string;
  main?: string;
  exports?: string | object;
};

export async function writeTestPackage(path: PortablePath, manifest: Manifest, files: Array<string>) {
  await yarn.writePackage(path, {...manifest, version: `1.0.0`});

  await Promise.all((files as Array<PortablePath>).map(async file => {
    const p = ppath.join(path, file);

    await xfs.mkdirpPromise(ppath.dirname(p));
    await xfs.writeFilePromise(p, `module.exports = __filename;\n`);
  }));
}

export type Assertions = {
  pass?: Array<[/*request: */string, /*resolved: */string]>;
  fail?: Array<[/*request: */string, {message: string, code: string, pnpCode?: string}]>;
};

export function makeTemporaryExportsEnv(testPackageName: string, manifest: Omit<Manifest, 'name'>, files: Array<string>, {pass, fail}: Assertions) {
  return makeTemporaryEnv({
    dependencies: {
      [testPackageName]: `file:./${testPackageName}`,
    },
  }, async ({path, run, source}) => {
    await writeTestPackage(`${path}/${testPackageName}` as PortablePath, {
      name: testPackageName,
      ...manifest,
    }, files);

    await run(`install`);

    const makeScript = (request: string) => `require(${JSON.stringify(request)})`;

    const getPathRelativeToPackageRoot = (filename: NativePath) => {
      const match = /node_modules\/.+?\/(.+)$/.exec(ppath.relative(path, npath.toPortablePath(filename)));
      if (match === null)
        throw new Error(`Assertion failed: Expected the match to be successful`);

      return match[1] as PortablePath;
    };

    const sourceRequest = (request: string) => source(makeScript(interpolateVariables(request))).then(p => getPathRelativeToPackageRoot(p as any));

    const interpolateVariables = (input: string) => input.replace(`$PKG`, testPackageName);

    if (typeof pass !== `undefined`) {
      for (const [request, file] of pass) {
        await expect(sourceRequest(request)).resolves.toBe(interpolateVariables(file));
      }
    }

    if (typeof fail !== `undefined`) {
      for (const [request, message] of fail) {
        const actualMessage = typeof message === `string` ? message : message.message;

        await expect(sourceRequest(request)).rejects.toMatchObject({
          externalException: {
            ...(typeof message === `object` ? message : {}),
            message: expect.stringContaining(interpolateVariables(actualMessage)),
          },
        });
      }
    }
  });
}

describe(`"exports" field`, () => {
  test(
    `implicit "main" field`,
    makeTemporaryExportsEnv(`main-implicit`, {}, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `index.js`],
        [`$PKG/file`, `file.js`],
      ],
    }),
  );

  test(
    `dotted "main" field`,
    makeTemporaryExportsEnv(`main-dotted`, {
      main: `./file.js`,
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/index`, `index.js`],
      ],
    }),
  );

  test(
    `dotless "main" field`,
    makeTemporaryExportsEnv(`main-dotless`, {
      main: `file.js`,
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/index`, `index.js`],
      ],
    }),
  );

  test(
    `dot-slash "main" field`,
    makeTemporaryExportsEnv(`main-dot-slash`, {
      main: `./`,
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `index.js`],
        [`$PKG/file`, `file.js`],
      ],
    }),
  );

  test(
    `string "exports" field`,
    makeTemporaryExportsEnv(`exports-string`, {
      exports: `./file.js`,
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and string "exports" field`,
    makeTemporaryExportsEnv(`main-exports-string`, {
      main: `main.js`,
      exports: `./file.js`,
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `file.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
      ],
      fail: [
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `top-level object conditional "exports" field`,
    makeTemporaryExportsEnv(`exports-top-level-object`, {
      exports: {
        import: `./import.mjs`,
        node: `./node.js`,
        require: `./require.js`,
        default: `./default.js`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `node.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and top-level object conditional "exports" field`,
    makeTemporaryExportsEnv(`main-exports-top-level-object`, {
      main: `main.js`,
      exports: {
        import: `./import.mjs`,
        node: `./node.js`,
        require: `./require.js`,
        default: `./default.js`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `node.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `dot object conditional "exports" field`,
    makeTemporaryExportsEnv(`exports-dot-object`, {
      exports: {
        [`.`]: {
          import: `./import.mjs`,
          node: `./node.js`,
          require: `./require.js`,
          default: `./default.js`,
        },
      },
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `node.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and dot object conditional "exports" field`,
    makeTemporaryExportsEnv(`main-exports-dot-object`, {
      main: `main.js`,
      exports: {
        [`.`]: {
          import: `./import.mjs`,
          node: `./node.js`,
          require: `./require.js`,
          default: `./default.js`,
        },
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `node.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `dot object conditional "exports" field with nested conditions`,
    makeTemporaryExportsEnv(`exports-dot-object`, {
      exports: {
        [`.`]: {
          node: {
            import: `./import.mjs`,
            require: `./require.js`,
          },
          default: `./default.js`,
        },
      },
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `require.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and dot object conditional "exports" field with nested conditions`,
    makeTemporaryExportsEnv(`main-exports-dot-object`, {
      main: `main.js`,
      exports: {
        [`.`]: {
          node: {
            import: `./import.mjs`,
            require: `./require.js`,
          },
          default: `./default.js`,
        },
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `node.js`,
      `require.js`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `require.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/node`, {message: `Package subpath './node' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `top-level array fallback "exports" field`,
    makeTemporaryExportsEnv(`exports-top-level-object`, {
      exports: [
        {import: `./import.mjs`},
        `./default.js`,
      ],
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `default.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and top-level array fallback "exports" field`,
    makeTemporaryExportsEnv(`main-exports-top-level-object`, {
      main: `main.js`,
      exports: [
        {import: `./import.mjs`},
        `./default.js`,
      ],
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `default.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `dot object array fallback "exports" field`,
    makeTemporaryExportsEnv(`exports-top-level-object`, {
      exports: {
        [`.`]: [
          {import: `./import.mjs`},
          `./default.js`,
        ],
      },
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `default.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field and dot object array fallback "exports" field`,
    makeTemporaryExportsEnv(`main-exports-top-level-object`, {
      main: `main.js`,
      exports: {
        [`.`]: [
          {import: `./import.mjs`},
          `./default.js`,
        ],
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `default.js`,
    ], {
      pass: [
        [`$PKG`, `default.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/import`, {message: `Package subpath './import' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/default`, {message: `Package subpath './default' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `object subpath "exports" field`,
    makeTemporaryExportsEnv(`exports-object-subpath`, {
      exports: {
        [`.`]: `./file.js`,
        [`./submodule`]: `./lib/submodule`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
      `lib/submodule.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/submodule`, `lib/submodule.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/inexistent`, {message: `Package subpath './inexistent' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `"main" field object subpath "exports" field`,
    makeTemporaryExportsEnv(`main-exports-object-subpath`, {
      main: `main.js`,
      exports: {
        [`.`]: `./file.js`,
        [`./submodule`]: `./lib/submodule`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `file.js`,
      `lib/submodule.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/submodule`, `lib/submodule.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/inexistent`, {message: `Package subpath './inexistent' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `object subpath patterns "exports" field`,
    makeTemporaryExportsEnv(`exports-object-subpath-patterns`, {
      exports: {
        [`.`]: `./file.js`,
        [`./src/*`]: `./lib/*`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
      `lib/a.js`,
      `lib/b.js`,
      `lib/c.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/src/a`, `lib/a.js`],
        [`$PKG/src/b`, `lib/b.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/inexistent`, {message: `Package subpath './inexistent' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src`, {message: `Package subpath './src' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src/`, {message: `Package subpath './src/' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/lib/c`, {message: `Package subpath './lib/c' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src/d`, {
          code: `MODULE_NOT_FOUND`,
          message: `Qualified path resolution failed`,
          pnpCode: `QUALIFIED_PATH_RESOLUTION_FAILED`,
        }],
      ],
    }),
  );

  test(
    `"main" field and object subpath patterns "exports" field`,
    makeTemporaryExportsEnv(`main-exports-object-subpath-patterns`, {
      main: `main.js`,
      exports: {
        [`.`]: `./file.js`,
        [`./src/*`]: `./lib/*`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `file.js`,
      `lib/a.js`,
      `lib/b.js`,
      `lib/c.js`,
    ], {
      pass: [
        [`$PKG`, `file.js`],
        [`$PKG/src/a`, `lib/a.js`],
        [`$PKG/src/b`, `lib/b.js`],
      ],
      fail: [
        [`$PKG/index`, {message: `Package subpath './index' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/main`, {message: `Package subpath './main' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/inexistent`, {message: `Package subpath './inexistent' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src`, {message: `Package subpath './src' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src/`, {message: `Package subpath './src/' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/lib/c`, {message: `Package subpath './lib/c' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
        [`$PKG/src/d`, {
          code: `MODULE_NOT_FOUND`,
          message: `Qualified path resolution failed`,
          pnpCode: `QUALIFIED_PATH_RESOLUTION_FAILED`,
        }],
      ],
    }),
  );

  test(
    `only import top-level object conditional "exports" field`,
    makeTemporaryExportsEnv(`exports-top-level-object-only-import`, {
      exports: {
        node: {
          import: `./node-import.mjs`,
        },
        import: `./import.mjs`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `import.mjs`,
      `node-import.mjs`,
    ], {
      fail: [
        [`$PKG`, {message: `No "exports" main defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `main field and only import top-level object conditional "exports" field`,
    makeTemporaryExportsEnv(`main-exports-top-level-object-only-import`, {
      main: `main.js`,
      exports: {
        node: {
          import: `./node-import.mjs`,
        },
        import: `./import.mjs`,
      },
    }, [
      `index.js`,
      `index.mjs`,
      `main.js`,
      `import.mjs`,
      `node-import.mjs`,
    ], {
      fail: [
        [`$PKG`, {message: `No "exports" main defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `manifest not exported`,
    makeTemporaryExportsEnv(`manifest-not-exported`, {
      exports: `./file.js`,
    }, [
      `index.js`,
      `index.mjs`,
      `file.js`,
    ], {
      fail: [
        [`$PKG/package.json`, {message: `Package subpath './package.json' is not defined`, code: `ERR_PACKAGE_PATH_NOT_EXPORTED`}],
      ],
    }),
  );

  test(
    `self-referencing with exports`,
    makeTemporaryEnv({
      name: `pkg`,
      exports: {
        [`.`]: `./main.js`,
        [`./foo`]: `./bar.js`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      await xfs.writeFilePromise(`${path}/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${path}/bar.js` as PortablePath, ``);

      await expect(source(`require.resolve('pkg')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/main.js`));
      await expect(source(`require.resolve('pkg/foo')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/bar.js`));
      await expect(source(`require.resolve('pkg/bar')`)).rejects.toMatchObject({
        externalException: {
          message: expect.stringContaining(`Package subpath './bar' is not defined`),
        },
      });
    }),
  );

  test(
    `link: with exports (inside the project)`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      await xfs.mkdirPromise(`${path}/linked` as PortablePath);

      await xfs.writeJsonPromise(`${path}/linked/package.json` as PortablePath, {
        name: `linked`,
        exports: {
          [`.`]: `./main.js`,
          [`./foo`]: `./bar.js`,
        },
      });

      await xfs.writeFilePromise(`${path}/linked/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${path}/linked/bar.js` as PortablePath, ``);

      await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
        name: `pkg`,
        dependencies: {
          [`linked`]: `link:./linked`,
        },
        exports: {
          [`.`]: `./main.js`,
          [`./foo`]: `./bar.js`,
        },
      });

      await xfs.writeFilePromise(`${path}/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${path}/bar.js` as PortablePath, ``);

      await run(`install`);

      await expect(source(`require.resolve('linked')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/linked/main.js`));
      await expect(source(`require.resolve('linked/foo')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/linked/bar.js`));
    }),
  );

  test(
    `link: with exports (outside the project)`,
    makeTemporaryEnv({}, async ({path, run, source}) => {
      const tmp = await xfs.mktempPromise();

      await xfs.writeJsonPromise(`${tmp}/package.json` as PortablePath, {
        name: `linked`,
        exports: {
          [`.`]: `./main.js`,
          [`./foo`]: `./bar.js`,
        },
      });

      await xfs.writeFilePromise(`${tmp}/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${tmp}/bar.js` as PortablePath, ``);

      await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
        name: `pkg`,
        dependencies: {
          [`linked`]: `link:${tmp}`,
        },
        exports: {
          [`.`]: `./main.js`,
          [`./foo`]: `./bar.js`,
        },
      });

      await xfs.writeFilePromise(`${path}/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${path}/bar.js` as PortablePath, ``);

      await run(`install`);

      await expect(source(`require.resolve('linked')`)).resolves.toStrictEqual(npath.fromPortablePath(`${tmp}/main.js`));
      await expect(source(`require.resolve('linked/foo')`)).resolves.toStrictEqual(npath.fromPortablePath(`${tmp}/bar.js`));
    }),
  );

  test(
    `pnpIgnorePatterns with exports (issuer ignored)`,
    makeTemporaryEnv(
      {},
      {
        pnpIgnorePatterns: `foo/**`,
      },
      async ({path, run, source}) => {
        await xfs.writeJsonPromise(`${path}/package.json` as PortablePath, {
          name: `pkg`,
          exports: {
            [`.`]: `./main.js`,
          },
        });

        await run(`install`);

        await xfs.writeFilePromise(`${path}/main.js` as PortablePath, ``);

        await xfs.mkdirpPromise(`${path}/node_modules/dep` as PortablePath);

        await xfs.writeJsonPromise(`${path}/node_modules/dep/package.json` as PortablePath, {
          name: `dep`,
          exports: {
            [`.`]: `./main.js`,
          },
        });

        await xfs.writeFilePromise(`${path}/node_modules/dep/main.js` as PortablePath, ``);

        await xfs.mkdirPromise(`${path}/foo` as PortablePath);

        await xfs.writeFilePromise(`${path}/foo/node-resolution.js` as PortablePath, `module.exports = require.resolve('dep');\n`);

        await expect(source(`require('./foo/node-resolution')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/node_modules/dep/main.js`));
      },
    ),
  );

  // TODO: write a better, self-contained test
  test(
    `pnpIgnorePatterns with exports (subpath ignored)`,
    async () => {
      expect(require.resolve(`@yarnpkg/monorepo/.yarn/sdks/typescript/lib/tsserver.js`)).toStrictEqual(npath.join(__dirname, `../../../../.yarn/sdks/typescript/lib/tsserver.js`));
    },
  );

  test(
    `pnpapi with exports`,
    makeTemporaryEnv({
      name: `pkg`,
      exports: {
        [`.`]: `./main.js`,

        // require.resolve(`pnpapi`) shouldn't be remappable
        [`pnpapi`]: `./pnpapi.js`,
        [`.pnp.cjs`]: `./pnpapi.js`,
      },
    }, async ({path, run, source}) => {
      await run(`install`);

      await xfs.writeFilePromise(`${path}/main.js` as PortablePath, ``);
      await xfs.writeFilePromise(`${path}/pnpapi.js` as PortablePath, `module.exports = 'pnpapi.js';`);

      // require goes through Module._load which doesn't call resolveRequest if the request is `pnpapi`
      await expect(source(`require('pnpapi')`)).resolves.toHaveProperty(`VERSIONS`);

      // require.resolve goes through Module._resolveFilename which calls resolveRequest
      await expect(source(`require.resolve('pnpapi')`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/.pnp.cjs`));

      await expect(source(`require('pnpapi').resolveToUnqualified('pnpapi', null)`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/.pnp.cjs`));
      await expect(source(`require('pnpapi').resolveRequest('pnpapi', null)`)).resolves.toStrictEqual(npath.fromPortablePath(`${path}/.pnp.cjs`));
    }),
  );
});
