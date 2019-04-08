import fs from 'fs';
import os from 'os';
import path from 'path';

function readdirNodeModules(pnp: any, dir: string, issuer: string): string[] | undefined {
  const dirs: { [dir: string]: string[] } = {};
  const locator = pnp.findPackageLocator(issuer);
  if (!locator) {
    return undefined;
  }
  const info = pnp.getPackageInformation(locator);
  if (info.packageLocation + '/' !== issuer) {
    return undefined;
  }
  const packages: string[] = Array.from(info.packageDependencies.keys());
  packages.forEach((pkg: string) => {
    dirs[''] = dirs[''] || [];
    if (pkg[0] === '@') {
      const [ scopeName, packageName ] = pkg.split('/');
      dirs[scopeName] = dirs[scopeName] || [];
      dirs[scopeName].push(packageName);
      if (dirs[''].indexOf(scopeName) < 0) {
        dirs[''].push(scopeName);
      }
    } else {
      dirs[''].push(pkg);
    }
  });
  return dirs[dir];
};

function getIssuerForNodeModulesPath(pnp: any, pathname: string) {
  const locator = pnp.findPackageLocator(pathname);
  if (!locator) {
    return undefined;
  }
  let issuer = pnp.getPackageInformation(locator).packageLocation;
  const remainder = pathname.substring(issuer.length);
  const issuers = [issuer].concat(remainder.split(/\/node_modules/));

  issuers[0] += '/';
  issuer = issuers[0];
  for (let issuerIdx = 1; issuerIdx < issuers.length; issuerIdx++) {
    issuers[issuerIdx] = issuers[issuerIdx].substring(1);
  }

  try {
    for (let issuerIdx = 1; issuerIdx < issuers.length; issuerIdx++) {
      if (issuers[issuerIdx] === '') continue;
      if (issuers[issuerIdx] === '@types') {
        return issuer;
      }
      const nextIssuer = pnp.resolveToUnqualified(issuers[issuerIdx], issuer);
      if (!nextIssuer) {
        return undefined;
      }
      issuer = nextIssuer + '/';
    }
    return issuer;
  } catch (e) {
  }
}

const pnpApiRoots: { [pnpRootDir: string]: any } = {};
const nonPnpPaths: { [pnpRootDir: string]: boolean } = {};

function getPnpApiForPath(pathname: string) {
  const basePath = pathname.substring(0, pathname.indexOf('node_modules') - 1);
  if (nonPnpPaths[basePath]) {
    return undefined;
  }
  for (let knownPnpRootDir of Object.keys(pnpApiRoots)) {
    if (basePath.startsWith(knownPnpRootDir)) {
      return pnpApiRoots[knownPnpRootDir];
    }
  }

  let remainderPath = basePath;
  while (true) {
    const pnpApiPath = path.join(remainderPath + '/', '.pnp.js');
    try {
      if (fs.existsSync(pnpApiPath)) {
        pnpApiRoots[remainderPath] = require(pnpApiPath);
        return pnpApiRoots[remainderPath];
      }
    } catch (e) {}
    const idx = remainderPath.lastIndexOf('/');
    if (idx < 0) {
      break;
    }
    remainderPath = remainderPath.substring(0, idx);
  }
  nonPnpPaths[basePath] = true;
  return undefined;
}

function resolvePath(pathname: string) {
  let targetPath = pathname;
  const idx = pathname.lastIndexOf('node_modules');
  const pnp = idx >= 0 && getPnpApiForPath(pathname);
  if (pnp) {
    const issuer = getIssuerForNodeModulesPath(pnp, pathname);
    if (issuer) {
      let request = pathname.substring(idx + 13);
      if (readdirNodeModules(pnp, request, issuer)) {
        targetPath = '.';
      } else if (request.length > 0) {
        try {
          targetPath = pnp.resolveToUnqualified(request, issuer, {considerBuiltins: false});
        } catch (e) {
          return undefined;
        }
      }
    }
  }
  return targetPath;
}

function mountVirtualNodeModulesFs() {
  const realFs: { [method: string]: Function } = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof (fs as any)[key] === 'function'
  });
  function fsProxy(this: { method: string }) {
    const args = Array.prototype.slice.call(arguments);
    try {
      if (['realpath', 'realpathSync'].indexOf(this.method) >= 0) {
        const targetPath = resolvePath(args[0].replace(/\\/g, '/'));
        if (!targetPath) {
          throw new Error(`ENOENT: no such file or directory, lstat '${args[0]}'`);
        }
        return targetPath;
      } else if (['access', 'accessSync', 'exists', 'existsSync', 'stat', 'statSync'].indexOf(this.method) >= 0) {
        const targetPath = resolvePath(args[0].replace(/\\/g, '/'));
        if (!targetPath) {
          throw new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
        }
        args[0] = targetPath;
      } else if (['readFile', 'readFileSync'].indexOf(this.method) >= 0) {
        const targetPath = resolvePath(args[0].replace(/\\/g, '/'));
        if (!targetPath) {
          throw new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
        }
        args[0] = targetPath;
      } else if (['readdir', 'readdirSync'].indexOf(this.method) >= 0) {
        const pathname = args[0].replace(/\\/g, '/');
        const idx = pathname.lastIndexOf('node_modules');
        const pnp = idx >= 0 && getPnpApiForPath(pathname);
        if (pnp) {
          const issuer = getIssuerForNodeModulesPath(pnp, pathname);
          if (issuer) {
            const request = pathname.substring(idx + 13);
            const dirs = readdirNodeModules(pnp, request, issuer);
            if (dirs) {
              return dirs;
            }
          }
        }
      }
    } catch (e) {
      if (e.message.indexOf('ENOENT') < 0) {
        fs.appendFileSync(path.join(os.tmpdir(), 'pnpify.log'), e.stack);
      } else {
        throw e;
      }
    }
    return realFs[this.method].apply(fs, args);
  }

  fsMethods.forEach(function (method) {
    realFs[method] = (fs as any)[method];
    (fs as any)[method] = fsProxy.bind({ method: method });
  });
}

mountVirtualNodeModulesFs();
