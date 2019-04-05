const pnp = require('pnpapi');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

function readdirNodeModules(dir, issuer) {
  const dirs = {};
  const locator = pnp.findPackageLocator(issuer);
  if (!locator) {
    return undefined;
  }
  const info = pnp.getPackageInformation(locator);
  if (info.packageLocation + '/' !== issuer) {
    return undefined;
  }
  const packages = Array.from(info.packageDependencies.keys());
  packages.forEach(function (pkg) {
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

function getIssuerForNodeModulesPath(pathname) {
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

function resolvePath(pathname) {
  let targetPath = pathname;
  const idx = pathname.lastIndexOf('node_modules');
  if (idx >= 0) {
    const issuer = getIssuerForNodeModulesPath(pathname);
    if (issuer) {
      let request = pathname.substring(idx + 13);
      if (readdirNodeModules(request, issuer)) {
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
  const realFs = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof fs[key] === 'function'
  });
  function fsProxy() {
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
        if (idx >= 0) {
          const issuer = getIssuerForNodeModulesPath(pathname);
          if (issuer) {
            const request = pathname.substring(idx + 13);
            const dirs = readdirNodeModules(request, issuer);
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
    realFs[method] = fs[method];
    fs[method] = fsProxy.bind({ method: method });
  });
}

mountVirtualNodeModulesFs();
