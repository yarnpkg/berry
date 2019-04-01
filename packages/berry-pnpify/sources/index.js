const pnp = require('pnpapi');
const fs = require('fs');
const path = require('path');
const Module = require('module');

function readdirNodeModules(dir, issuer) {
  const dirs = {};
  const info = pnp.getPackageInformation(pnp.findPackageLocator(issuer));
  if (!info || (info.packageLocation + '/') !== issuer) {
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
  const issuers = pathname.split(/\/node_modules/);

  issuers[0] += '/';
  for (let issuerIdx = 1; issuerIdx < issuers.length; issuerIdx++) {
    issuers[issuerIdx] = issuers[issuerIdx].substring(1);
  }

  let issuer = issuers[0];
  try {
    for (let issuerIdx = 1; issuerIdx < issuers.length; issuerIdx++) {
      issuer = pnp.resolveToUnqualified(issuers[issuerIdx], issuer) + '/';
    }
    return issuer;
  } catch (e) {
  }
}

function resolvePath(pathname) {
  let targetPath = pathname;
  const idx = pathname.lastIndexOf('node_modules');
  if (idx >= 0) {
    const issuer = getIssuerForNodeModulesPath(pathname.substring(0, idx - 1));
    if (issuer) {
      const request = pathname.substring(idx + 13);
      if (readdirNodeModules(request, issuer)) {
        targetPath = '.';
      } else if (request.length > 0) {
        try {
          targetPath = pnp.resolveToUnqualified(request, issuer, {considerBuiltins: false});
        } catch (e) {
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
    if (this.method === 'statSync') {
      const targetPath = resolvePath(arguments[0].replace(/\\/g, '/'));
      const args = Array.prototype.slice.call(arguments);
      args[0] = targetPath;
      return realFs[this.method].apply(fs, args);
    } else if (this.method === 'readFileSync') {
      const targetPath = resolvePath(arguments[0].replace(/\\/g, '/'));
      const args = Array.prototype.slice.call(arguments);
      args[0] = targetPath;
      return realFs[this.method].apply(fs, args);
    } else if (this.method === 'readdirSync') {
      const pathname = arguments[0].replace(/\\/g, '/');
      const idx = pathname.lastIndexOf('node_modules');
      if (idx >= 0) {
        const issuer = getIssuerForNodeModulesPath(pathname.substring(0, idx - 1));
        if (issuer) {
          const request = pathname.substring(idx + 13);
          const dirs = readdirNodeModules(request, issuer);
          if (dirs) {
            return dirs;
          }
        }
      }
    }
    return realFs[this.method].apply(fs, arguments);
  }

  fsMethods.forEach(function (method) {
    realFs[method] = fs[method];
    fs[method] = fsProxy.bind({ method: method });
  });
}

mountVirtualNodeModulesFs();