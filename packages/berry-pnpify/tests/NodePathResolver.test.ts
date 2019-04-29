import { NodePathResolver } from '../sources/NodePathResolver';
import { PnPApiLoader } from '../sources/PnPApiLoader';
import { PnPApiLocator } from '../sources/PnPApiLocator';

const API_PATH = '/home/user/proj/.pnp.js';

describe('NodePathResolver should', () => {
  let resolver: NodePathResolver;

  beforeEach(() => {
    const apiLoader = new PnPApiLoader({
      watch: jest.fn()
    });
    const pkgMap: { [pkg: string]: { packageLocation: string } } = {
      monorepo: { packageLocation: '/home/user/proj' },
      foo: { packageLocation: '/home/user/proj/.cache/foo/node_modules/foo' },
      bar: { packageLocation: '/home/user/proj/.cache/bar/node_modules/bar' }
    };
    Object.defineProperty(apiLoader, 'getApi', { value: jest.fn().mockImplementation((pathname) => pathname.indexOf('/home/user/proj') !== 0 ? null : ({
      findPackageLocator: (pathname: string) => {
        if (pathname.indexOf('/home/user/proj/.cache/foo/node_modules/foo/') === 0) {
          return { package: 'foo' };
        } else if (pathname.indexOf('/home/user/proj/.cache/bar/node_modules/bar/') === 0) {
          return { package: 'bar' };
        } else if (pathname.indexOf('/home/user/proj/') === 0) {
          return { package: 'monorepo' }
        } else {
          return null;
        }
      },
      getPackageInformation: (info: { package: string }) => pkgMap[info.package],
      resolveToUnqualified: (request: string, issuer: string) => {
        if (issuer === pkgMap.monorepo.packageLocation + '/' && request === 'foo') {
          return pkgMap.foo.packageLocation;
        } else if (issuer === pkgMap.foo.packageLocation + '/' && request === 'bar') {
          return pkgMap.bar.packageLocation;
        } else {
          throw new Error();
        }
      }
    }))});
    const apiLocator = new PnPApiLocator({
      existsSync: path => path === API_PATH
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

  it('resolve /home/user/proj/node_modules path', () => {
    const nodePath = '/home/user/proj/node_modules';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: '/home/user/proj' });
  });

  it('partially resolve /home/user/proj/node_modules/@scope path', () => {
    const nodePath = '/home/user/proj/node_modules/@scope';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, issuer: '/home/user/proj', issuerInfo: { packageLocation: '/home/user/proj' }, request: '@scope' });
  });

  it('not change path inside pnp dependency', () => {
    const nodePath = '/home/user/proj/.cache/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: nodePath });
  });

  it('resolve /home/user/proj/node_modules/foo path', () => {
    const nodePath = '/home/user/proj/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo' });
  });

  it('enter resolve package and leave request intact in /home/user/proj/node_modules/foo/a/b/c/index.js', () => {
    const nodePath = '/home/user/proj/node_modules/foo/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: '/home/user/proj/.cache/foo/node_modules/foo/a/b/c/index.js' });
  });

  it('enter into two packages in a path and leave request intact', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/bar/a/b/c/index.js';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: '/home/user/proj/.cache/bar/node_modules/bar/a/b/c/index.js' });
  });

  it('return null if issuer has no given dependency', () => {
    const nodePath = '/home/user/proj/node_modules/bar';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: null });
  })

  it('return null if packages dependends on itself', () => {
    const nodePath = '/home/user/proj/node_modules/foo/node_modules/foo';
    const pnpPath = resolver.resolvePath(nodePath);
    expect(pnpPath).toEqual({ apiPath: API_PATH, resolvedPath: null });
  });
});
