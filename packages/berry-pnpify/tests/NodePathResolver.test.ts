import { NodePathResolver } from '../sources/NodePathResolver';
import { PnPApiLoader } from '../sources/PnPApiLoader';
import { PnPApiLocator } from '../sources/PnPApiLocator';

type PkgMap = { [pkg: string]: { packageLocation: string, packageDependencies: Map<string, string> } };

const defineGetApiMock = (apiLoader: PnPApiLoader, pkgMap: PkgMap, pathSep: string) => {
  Object.defineProperty(apiLoader, 'getApi', { value: jest.fn().mockImplementation((pathname) => pathname.indexOf(pkgMap.monorepo.packageLocation + pathSep + '.pnp.js') !== 0 ? null : ({
    findPackageLocator: (pathname: string) => {
      if (pathname.indexOf(pkgMap.foo.packageLocation) === 0) {
        return { package: 'foo' };
      } else if (pathname.indexOf(pkgMap.bar.packageLocation) === 0) {
        return { package: 'bar' };
      } else if (pathname.indexOf(pkgMap.monorepo.packageLocation) === 0) {
        return { package: 'monorepo' }
      } else {
        return null;
      }
    },
    getPackageInformation: (info: { package: string }) => pkgMap[info.package],
    resolveToUnqualified: (request: string, issuer: string) => {
      if (issuer === pkgMap.monorepo.packageLocation + pathSep && request === 'foo') {
        return pkgMap.foo.packageLocation;
      } else if (issuer === pkgMap.foo.packageLocation + pathSep && request === 'bar') {
        return pkgMap.bar.packageLocation;
      } else {
        throw new Error();
      }
    }
  }))});
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

const windowsPkgMap: PkgMap = {
  monorepo: {
    packageLocation: 'C:\\Users\\user\\proj',
    packageDependencies: new Map([['foo', '1.0.0'], ['bar', '1.0.0'], ['@scope/baz', '2.0.0']])
  },
  foo: {
    packageLocation: 'C:\\Users\\user\\proj\\.cache\\foo\\node_modules\\foo',
    packageDependencies: new Map([['bar', '1.0.0']])
  },
  bar: { packageLocation: 'C:\\Users\\user\\proj\\.cache\\bar\\node_modules\\bar', packageDependencies: new Map() }
};

describe('NodePathResolver should', () => {
  let resolver: NodePathResolver;

  beforeEach(() => {
    const apiLoader = new PnPApiLoader({
      watch: jest.fn()
    });
    defineGetApiMock(apiLoader, posixPkgMap, '/');
    const apiLocator = new PnPApiLocator({
      existsSync: path => path === posixPkgMap.monorepo.packageLocation + '/.pnp.js'
    });
    resolver = new NodePathResolver({ apiLoader, apiLocator });
  });

  it('not change paths outside of pnp project', () => {
    const pnpPath = resolver.resolvePath('/home/user');
    expect(pnpPath.resolvedPath).toEqual('/home/user');
  });

  it('not try to alter paths without node_modules inside pnp project', () => {
    const nodePath = '/home/user/proj/.cache/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: nodePath });
  });

  it('resolve /home/user/proj path', () => {
    const nodePath = '/home/user/proj';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj' });
  });

  it('resolve /home/user/proj/node_modules path', () => {
    const nodePath = '/home/user/proj/node_modules';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/node_modules', statPath: '/home/user/proj', dirList: ['foo', 'bar', '@scope'] });
  });

  it('partially resolve /home/user/proj/node_modules/@scope path', () => {
    const nodePath = '/home/user/proj/node_modules/@scope';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/node_modules/@scope', statPath: '/home/user/proj', dirList: ['baz'] });
  });

  it('not change path inside pnp dependency', () => {
    const nodePath = '/home/user/proj/.cache/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: nodePath });
  });

  it('resolve /home/user/proj/node_modules/foo path', () => {
    const nodePath = '/home/user/proj/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo' });
  });

  it('enter resolve package and leave request intact in /home/user/proj/node_modules/foo/a/b/c/index.js', () => {
    const nodePath = '/home/user/proj/node_modules/foo/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo/a/b/c/index.js' });
  });

  it('enter into two packages in a path and leave request intact', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/bar/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: '/home/user/proj/.cache/bar/node_modules/bar/a/b/c/index.js' });
  });

  it('return null if issuer has no given dependency', () => {
    const nodePath = '/home/user/proj/node_modules/bar';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: null });
  })

  it('return null if packages dependends on itself', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: null });
  });

  it('handle Windows pnpapi and source path', () => {
    const apiLoader = new PnPApiLoader({
      watch: jest.fn()
    });
    defineGetApiMock(apiLoader, windowsPkgMap, '\\');
    const apiLocator = new PnPApiLocator({
      existsSync: path => path === windowsPkgMap.monorepo.packageLocation + '\\.pnp.js'
    });
    resolver = new NodePathResolver({ apiLoader, apiLocator });
    const nodePath = 'C:\\Users\\user\\proj\\node_modules\\foo\\node_modules\\bar\\a\\b\\c\\index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ resolvedPath: 'C:\\Users\\user\\proj\\.cache\\bar\\node_modules\\bar\\a\\b\\c\\index.js' });
  });
});
