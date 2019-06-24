import { PnpApi } from '@berry/pnp';

import { NodePathResolver } from '../sources/NodePathResolver';

type PkgMap = { [pkg: string]: { packageLocation: string, packageDependencies: Map<string, string> } };

const pnpApiMock = (pkgMap: PkgMap): PnpApi => {
  return ({
    findPackageLocator: jest.fn().mockImplementation((pathname: string) => {
      if (pathname.indexOf(pkgMap.foo.packageLocation) === 0) {
        return { package: 'foo' };
      } else if (pathname.indexOf(pkgMap.bar.packageLocation) === 0) {
        return { package: 'bar' };
      } else if (pathname.indexOf(pkgMap.monorepo.packageLocation) === 0) {
        return { package: 'monorepo' }
      } else {
        return null;
      }
    }),
    getPackageInformation: jest.fn().mockImplementation((info: { package: string }) => pkgMap[info.package]),
    resolveToUnqualified: jest.fn().mockImplementation((request: string, issuer: string) => {
      if (issuer === pkgMap.monorepo.packageLocation + '/' && request === 'foo') {
        return pkgMap.foo.packageLocation;
      } else if (issuer === pkgMap.foo.packageLocation + '/' && request === 'bar') {
        return pkgMap.bar.packageLocation;
      } else {
        throw new Error();
      }
    })
  }) as PnpApi;
}

const posixPkgMap: PkgMap = {
  monorepo: {
    packageLocation: '/home/user/proj',
    packageDependencies: new Map([['foo', '1.0.0'], ['bar', '1.0.0'], ['@scope/baz', '2.0.0']])
  },
  foo: {
    packageLocation: '/home/user/proj/.cache/foo/node_modules/foo',
    packageDependencies: new Map([['bar', '1.0.0']])
  },
  bar: { packageLocation: '/home/user/proj/.cache/bar/node_modules/bar', packageDependencies: new Map() }
};

describe('NodePathResolver', () => {
  let resolver: NodePathResolver;

  beforeAll(() => {
    resolver = new NodePathResolver(pnpApiMock(posixPkgMap));
  });

  it('should not change paths outside of pnp project', () => {
    const pnpPath = resolver.resolvePath('/home/user/node_modules/a/b/c');
    expect(pnpPath.resolvedPath).toEqual('/home/user/node_modules/a/b/c');
  });

  it('should not try to alter paths without node_modules inside pnp project', () => {
    const nodePath = '/home/user/proj/.cache/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: nodePath });
  });

  it('should not try to alter paths from a dotted node_modules entry', () => {
    const nodePath = '/home/user/proj/node_modules/.foo/bar';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: nodePath });
  });

  it('should resolve /home/user/proj path', () => {
    const nodePath = '/home/user/proj';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj' });
  });

  it('should resolve /home/user/proj/node_modules path', () => {
    const nodePath = '/home/user/proj/node_modules';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/node_modules', statPath: '/home/user/proj', dirList: ['foo', 'bar', '@scope'] });
  });

  it('should partially resolve /home/user/proj/node_modules/@scope path', () => {
    const nodePath = '/home/user/proj/node_modules/@scope';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/node_modules/@scope', statPath: '/home/user/proj', dirList: ['baz'] });
  });

  it('should not change path inside pnp dependency', () => {
    const nodePath = '/home/user/proj/.cache/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: nodePath });
  });

  it('should resolve /home/user/proj/node_modules/foo path', () => {
    const nodePath = '/home/user/proj/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo' });
  });

  it('should enter resolve package and leave request intact in /home/user/proj/node_modules/foo/a/b/c/index.js', () => {
    const nodePath = '/home/user/proj/node_modules/foo/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo/a/b/c/index.js' });
  });

  it('should enter into two packages in a path and leave request intact', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/bar/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/bar/node_modules/bar/a/b/c/index.js' });
  });

  it('should return null if issuer has no given dependency', () => {
    const nodePath = '/home/user/proj/node_modules/bar';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: null });
  })

  it('should return null if packages dependends on itself', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: null });
  });
});
