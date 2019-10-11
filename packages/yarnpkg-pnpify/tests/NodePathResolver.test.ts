import {NodeFS}           from '@yarnpkg/fslib';
import {PnpApi}           from '@yarnpkg/pnp';

import {NodePathResolver} from '../sources/NodePathResolver';

type PkgMap = { [pkg: string]: { packageLocation: string, packageDependencies: Map<string, string> } };

const makePnpApiMock = (pkgMap: PkgMap): PnpApi => {
  return ({
    VERSIONS: {std: 1},
    topLevel: {name: null, reference: null},
    resolveUnqualified: jest.fn(),
    resolveRequest: jest.fn(),
    getDependencyTreeRoots: jest.fn(),
    findPackageLocator: jest.fn().mockImplementation((pathname: string) => {
      if (pathname.indexOf(pkgMap.foo.packageLocation) === 0) {
        return {package: 'foo'};
      } else if (pathname.indexOf(pkgMap.bar.packageLocation) === 0) {
        return {package: 'bar'};
      } else if (pathname.indexOf(pkgMap.monorepo.packageLocation) === 0) {
        return {package: 'monorepo'};
      } else {
        return null;
      }
    }),
    getPackageInformation: jest.fn().mockImplementation((info: { package: string }) => pkgMap[info.package]),
    resolveToUnqualified: jest.fn().mockImplementation((request: string, issuer: string) => {
      if (issuer === `${pkgMap.monorepo.packageLocation}/` && request === 'monorepo') {
        return pkgMap.monorepo.packageLocation;
      } else if (issuer === `${pkgMap.monorepo.packageLocation}/` && request === 'foo') {
        return pkgMap.foo.packageLocation;
      } else if (issuer === `${pkgMap.foo.packageLocation}/` && request === 'bar') {
        return pkgMap.bar.packageLocation;
      } else {
        throw new Error();
      }
    }),
  }) as PnpApi;
};

const posixPkgMap: PkgMap = {
  monorepo: {
    packageLocation: '/home/user/proj',
    packageDependencies: new Map([['monorepo', '1.0.0'], ['foo', '1.0.0'], ['bar', '1.0.0'], ['@scope/baz', '2.0.0']]),
  },
  foo: {
    packageLocation: '/home/user/proj/.cache/foo/node_modules/foo',
    packageDependencies: new Map([['bar', '1.0.0']]),
  },
  bar: {
    packageLocation: '/home/user/proj/.cache/bar/node_modules/bar',
    packageDependencies: new Map(),
  },
};

describe('NodePathResolver', () => {
  let resolver: NodePathResolver;

  beforeAll(() => {
    resolver = new NodePathResolver(makePnpApiMock(posixPkgMap));
  });

  it('should not change paths outside of pnp project', () => {
    const pnpPath = resolver.resolvePath(NodeFS.toPortablePath('/home/user/node_modules/a/b/c'));
    expect(pnpPath.resolvedPath).toEqual('/home/user/node_modules/a/b/c');
  });

  it('should not try to alter paths without node_modules inside pnp project', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/.cache/foo');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: nodePath});
  });

  it('should not try to alter paths from a dotted node_modules entry', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/.foo/bar');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: nodePath});
  });

  it('should resolve /home/user/proj path', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj'});
  });

  it('should resolve /home/user/proj/node_modules path', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/node_modules', statPath: '/home/user/proj', dirList: new Set(['monorepo', 'foo', 'bar', '@scope'])});
  });

  it('should resolve /home/user/proj/node_modules/monorepo path as a symlink to itself', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/monorepo');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj', isSymlink: true});
  });

  it('should resolve /home/user/proj/node_modules/monorepo/index.js without it being reported a symlink', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/monorepo/index.js');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/index.js'});
  });

  it('should partially resolve /home/user/proj/node_modules/@scope path', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/@scope');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/node_modules/@scope', statPath: '/home/user/proj', dirList: new Set(['baz'])});
  });

  it('should not change path inside pnp dependency', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/.cache/foo/node_modules/foo');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: nodePath});
  });

  it('should resolve /home/user/proj/node_modules/foo path', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/foo');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo'});
  });

  it('should enter resolve package and leave request intact in /home/user/proj/node_modules/foo/a/b/c/index.js', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/foo/a/b/c/index.js');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo/a/b/c/index.js'});
  });

  it('should enter into two packages in a path and leave request intact', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/foo/node_modules/bar/a/b/c/index.js');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: '/home/user/proj/.cache/bar/node_modules/bar/a/b/c/index.js'});
  });

  it('should return null if issuer has no given dependency', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/bar');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: null});
  });

  it('should return null if packages dependends on itself', () => {
    const nodePath = NodeFS.toPortablePath('/home/user/proj/node_modules/foo/node_modules/foo');
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({resolvedPath: null});
  });
});
