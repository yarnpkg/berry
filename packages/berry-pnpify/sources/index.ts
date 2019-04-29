import fs                   from 'fs';
import os                   from 'os';
import path                 from 'path';

import { NodePathResolver } from './NodePathResolver';
import { PnPApiLoader }     from './PnPApiLoader';
import { PnPApiLocator }    from './PnPApiLocator';
import { VirtualDirReader } from './VirtualDirReader';

function mountVirtualNodeModulesFs() {
  const realFs: { [method: string]: Function } = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof (fs as any)[key] === 'function'
  });
  fsMethods.forEach(function (method) {
    realFs[method] = (fs as any)[method];
    (fs as any)[method] = fsProxy.bind({ method: method });
  });

  const apiLoader = new PnPApiLoader({ watch: realFs.watch.bind(fs) });
  const pathResolver = new NodePathResolver({
    apiLoader,
    apiLocator: new PnPApiLocator({ existsSync: fs.existsSync.bind(fs) })
  });
  const dirReader = new VirtualDirReader();

  function fsProxy(this: { method: string }) {
    const args = Array.prototype.slice.call(arguments);
    let hasResult = false;
    let result;
    try {
      if (['accessSync', 'existsSync', 'stat', 'statSync'].indexOf(this.method) >= 0) {
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
          if (['existsSync'].indexOf(this.method) >= 0)
            result = false;
           else if (['stat'].indexOf(this.method) < 0)
            result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);

          hasResult = true;
        }
      } else if (['realpathSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        let realPath;
        if (pnpPath.resolvedPath) {
          realPath = pnpPath.resolvedPath;
        } else if (pnpPath.resolvedPath === undefined) {
          if (dirReader.readDir(pnpPath) !== null) {
            realPath = args[0];
          }
        }
        if (realPath)
          result = realPath;
         else
          result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);

        hasResult = true;
      } else if (['readFileSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          result = new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
          hasResult = true;
        } else {
          args[0] = pnpPath.resolvedPath;
        }
      } else if (['readdirSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (pnpPath.resolvedPath === null) {
          result = new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
          hasResult = true;
        } else if (pnpPath.resolvedPath === undefined) {
          const dirList = dirReader.readDir(pnpPath);
          if (dirList === null) {
            result = new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
            hasResult = true;
          } else {
            result = dirList;
            hasResult = true;
          }
        } else {
          args[0] = pnpPath.resolvedPath;
        }
      }
    } catch (e) {
      realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), e.stack + '\n']);
    }
    try {
      if (hasResult && result instanceof Error)
        throw result;

      const finalResult = hasResult ? result : realFs[this.method].apply(fs, args);
      if (process.env.PNPIFY_TRACE && arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0) {
        const dumpedResult = this.method === 'watch' || finalResult === undefined ? '' : ' = ' + JSON.stringify(finalResult instanceof Buffer ? finalResult.toString() : finalResult);
        realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] + ' -> ' + args[0] + dumpedResult + '\n']);
      }
      return finalResult;
    } catch (e) {
      if (process.env.PNPIFY_TRACE && arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0)
        realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] + ' -> ' + args[0] + ' = ' + ((e.message.indexOf('ENOENT') >= 0 || e.message.indexOf('ENOTDIR') >= 0) ? e.message : e.stack) + '\n']);

      throw e;
    }
  }
}

mountVirtualNodeModulesFs();
