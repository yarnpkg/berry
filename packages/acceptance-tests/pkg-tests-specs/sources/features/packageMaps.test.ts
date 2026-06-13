import {Filename, PortablePath, npath, ppath, xfs} from '@yarnpkg/fslib';
import {yarn}                                      from 'pkg-tests-core';

const {
  fs: {writeFile, writeJson},
} = require(`pkg-tests-core`);

const PACKAGE_MAP = `.package-map.json` as Filename;

const getPackageMapPath = (path: PortablePath) => {
  return ppath.join(path, Filename.nodeModules, PACKAGE_MAP);
};

type Source = (script: string, callDefinition?: {env?: Record<string, string>}) => Promise<unknown>;

const sourceWithPackageMap = async (path: PortablePath, source: Source, script: string) => {
  return await source(script, {
    env: {
      NODE_OPTIONS: `--experimental-package-map=${npath.fromPortablePath(getPackageMapPath(path))}`,
    },
  });
};

const requireFromPackage = (packageName: string, request: string) => {
  return `require('module').createRequire(process.cwd() + '/node_modules/${packageName}/index.js')(${JSON.stringify(request)})`;
};

describe(`Package maps`, () => {
  it(`should allow packages to require their declared dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`one-fixed-dep`, `.`))).resolves.toMatchObject({
          name: `one-fixed-dep`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps`]: {
              name: `no-deps`,
              version: `1.0.0`,
            },
          },
        });
      },
    ),
  );

  it(`should reject undeclared dependencies even when they are hoisted`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`no-deps`]: `1.0.0`,
          [`various-requires`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await run(`install`);

        // This should work because the package map isn't here to reject undeclared dependencies
        await expect(source(requireFromPackage(`various-requires`, `./invalid-require`))).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`various-requires`, `./invalid-require`))).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  it(`should allow package extensions to declare additional dependencies`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`various-requires`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await yarn.writeConfiguration(path, {
          packageExtensions: {
            [`various-requires@*`]: {
              dependencies: {
                [`no-deps`]: `1.0.0`,
              },
            },
          },
        });

        await run(`install`);

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`various-requires`, `./invalid-require`))).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });
      },
    ),
  );

  it(`should resolve aliases through their alias name`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`requester`]: `file:./requester`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await writeJson(ppath.join(path, `requester/package.json` as PortablePath), {
          name: `requester`,
          version: `1.0.0`,
          dependencies: {
            [`no-deps2`]: `npm:no-deps@2.0.0`,
          },
        });
        await writeFile(ppath.join(path, `requester/index.js` as PortablePath), ``);

        await run(`install`);

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`requester`, `no-deps2`))).resolves.toMatchObject({
          name: `no-deps`,
          version: `2.0.0`,
        });

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`requester`, `no-deps`))).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );

  it(`should resolve dependencies from the issuer package instance`,
    makeTemporaryEnv(
      {
        private: true,
        workspaces: [`workspace`],
        dependencies: {
          [`one-fixed-dep`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
        nmHoistingLimits: `workspaces`,
      },
      async ({path, run, source}) => {
        await writeJson(ppath.join(path, `workspace/package.json` as PortablePath), {
          name: `workspace`,
          version: `1.0.0`,
          dependencies: {
            [`one-fixed-dep`]: `1.0.0`,
          },
        });
        await writeFile(ppath.join(path, `workspace/index.js` as PortablePath), ``);

        await run(`install`);

        await expect(sourceWithPackageMap(path, source, `{
          const path = require('path');
          const rootOneFixedDepRequire = require('module').createRequire(path.join(process.cwd(), 'node_modules/one-fixed-dep/index.js'));
          const workspaceOneFixedDepPath = path.join(process.cwd(), 'workspace/node_modules/one-fixed-dep');
          const workspaceOneFixedDepRequire = require('module').createRequire(path.join(workspaceOneFixedDepPath, 'index.js'));

          return {
            rootDependencyLocation: rootOneFixedDepRequire.resolve('.'),
            rootDependency: rootOneFixedDepRequire('.'),
            workspaceDependencyLocation: workspaceOneFixedDepRequire.resolve(workspaceOneFixedDepPath),
            workspaceDependency: workspaceOneFixedDepRequire(workspaceOneFixedDepPath),
          };
        }`)).resolves.toMatchObject({
          rootDependencyLocation: expect.stringContaining(`${npath.sep}node_modules${npath.sep}one-fixed-dep${npath.sep}index.js`),
          rootDependency: {
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          },
          workspaceDependencyLocation: expect.stringContaining(`${npath.sep}workspace${npath.sep}node_modules${npath.sep}one-fixed-dep${npath.sep}index.js`),
          workspaceDependency: {
            dependencies: {
              [`no-deps`]: {
                name: `no-deps`,
                version: `1.0.0`,
              },
            },
          },
        });
      },
    ),
  );

  it(`should refresh dependency access after package extensions are removed`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`various-requires`]: `1.0.0`,
        },
      },
      {
        nodeLinker: `node-modules`,
      },
      async ({path, run, source}) => {
        await yarn.writeConfiguration(path, {
          packageExtensions: {
            [`various-requires@*`]: {
              dependencies: {
                [`no-deps`]: `1.0.0`,
              },
            },
          },
        });

        await run(`install`);

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`various-requires`, `./invalid-require`))).resolves.toMatchObject({
          name: `no-deps`,
          version: `1.0.0`,
        });

        await xfs.removePromise(ppath.join(path, `.yarnrc.yml` as Filename));
        await run(`install`);

        await expect(sourceWithPackageMap(path, source, requireFromPackage(`various-requires`, `./invalid-require`))).rejects.toMatchObject({
          externalException: {
            code: `MODULE_NOT_FOUND`,
          },
        });
      },
    ),
  );
});
