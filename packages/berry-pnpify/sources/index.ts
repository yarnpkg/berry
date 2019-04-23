import fs from 'fs';
import os from 'os';
import path from 'path';

import { PnPApiLoader } from './PnPApiLoader';
import { PnPApiLocator } from './PnPApiLocator';
import { NodePathResolver, ResolvedPath } from './NodePathResolver';

const readdir = (pnpPath: ResolvedPath): string[] => {
  const result = [];
  if (pnpPath.issuerInfo) {
    for (const key of pnpPath.issuerInfo.packageDependencies.keys()) {
      const [ scope, pkgName ] = key.split('/');
      if (pnpPath.request === '') {
        result.push(scope);
      } else if (pnpPath.request === scope) {
        result.push(pkgName);
      }
    }
  }
  return result;
};

function mountVirtualNodeModulesFs() {
  const realFs: { [method: string]: Function } = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof (fs as any)[key] === 'function'
  });
  const pathResolver = new NodePathResolver({
    apiLoader: new PnPApiLoader({ watch: fs.watch.bind(fs) }),
    apiLocator: new PnPApiLocator({ existsSync: fs.existsSync.bind(fs) })
  });
  function fsProxy(this: { method: string }) {
    const args = Array.prototype.slice.call(arguments);
    try {
      if (['access', 'accessSync', 'exists', 'existsSync', 'stat', 'statSync', 'realpath', 'realpathSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        let fileMightExist = true;
        if (pnpPath.resolvedPath === null) {
          fileMightExist = false;
        } else if (pnpPath.resolvedPath === undefined) {
          if (readdir(pnpPath).length === 0) {
            fileMightExist = false;
          } else {
            args[0] = pnpPath.issuer;
          }
        } else {
          args[0] = pnpPath.resolvedPath;
        }
        if (!fileMightExist) {
          if (['exists', 'existsSync'].indexOf(this.method) >= 0) {
            return false;
          } else {
            throw new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
          }
        }
        if (['realpath', 'realpathSync'].indexOf(this.method) >= 0) {
          return args[0];
        }
      } else if (['readFile', 'readFileSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          throw new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
        }
        args[0] = pnpPath.resolvedPath;
      } else if (['readdir', 'readdirSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (pnpPath.resolvedPath === undefined && !pnpPath.issuerInfo) {
          throw new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
        } else if (pnpPath.issuerInfo) {
          const dirList = readdir(pnpPath);
          if (dirList.length > 0) {
            return dirList;
          } else {
            throw new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
          }
        }
      }
    } catch (e) {
      if (e.message.indexOf('ENOENT') < 0 && e.message.indexOf('ENOTDIR') < 0) {
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
