import fs from 'fs';
import os from 'os';
import path from 'path';

import { PnPApiLoader } from './PnPApiLoader';
import { PnPApiLocator } from './PnPApiLocator';
import { NodePathResolver } from './NodePathResolver';
import { VirtualDirReader } from './VirtualDirReader';

function mountVirtualNodeModulesFs() {
  const realFs: { [method: string]: Function } = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof (fs as any)[key] === 'function'
  });
  const pathResolver = new NodePathResolver({
    apiLoader: new PnPApiLoader({ watch: fs.watch.bind(fs) }),
    apiLocator: new PnPApiLocator({ existsSync: fs.existsSync.bind(fs) })
  });
  const dirReader = new VirtualDirReader();
  function fsProxy(this: { method: string }) {
    const args = Array.prototype.slice.call(arguments);
    try {
      if (['accessSync', 'existsSync', 'stat', 'statSync', 'realpathSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        let fileMightExist = true;
        if (pnpPath.resolvedPath === null) {
          fileMightExist = false;
        } else if (pnpPath.resolvedPath === undefined) {
          if (dirReader.readDir(pnpPath) === null) {
            fileMightExist = false;
          } else {
            args[0] = pnpPath.issuer;
          }
        } else {
          args[0] = pnpPath.resolvedPath;
        }
        if (!fileMightExist) {
          if (['existsSync'].indexOf(this.method) >= 0) {
            return false;
          } else if (['stat'].indexOf(this.method) < 0) {
            throw new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
          }
        }
        if (['realpathSync'].indexOf(this.method) >= 0) {
          return args[0];
        }
      } else if (['readFileSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          throw new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
        }
        args[0] = pnpPath.resolvedPath;
      } else if (['readdirSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (pnpPath.resolvedPath === undefined && !pnpPath.issuerInfo) {
          throw new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
        } else if (pnpPath.issuerInfo) {
          const dirList = dirReader.readDir(pnpPath);
          if (dirList !== null) {
            return dirList;
          } else {
            throw new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
          }
        }
      }
    } catch (e) {
      if (e.message.indexOf('ENOENT') < 0 && e.message.indexOf('ENOTDIR') < 0) {
        fs.appendFileSync(path.join(os.tmpdir(), 'pnpify.log'), e.stack + '\n');
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
