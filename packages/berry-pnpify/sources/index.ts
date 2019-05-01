import fs                   from 'fs';
import os                   from 'os';
import path                 from 'path';

import { NodePathResolver } from './NodePathResolver';
import { PnPApiLoader }     from './PnPApiLoader';
import { PnPApiLocator }    from './PnPApiLocator';

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

  function fsProxy(this: { method: string }) {
    const args = Array.prototype.slice.call(arguments);
    let result = undefined;
    try {
      if (['accessSync', 'existsSync', 'stat', 'statSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (['stat'].indexOf(this.method) < 0 && !pnpPath.resolvedPath) {
          result = ['existsSync'].indexOf(this.method) >= 0 ? false : new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
        } else if (pnpPath.resolvedPath) {
          args[0] = pnpPath.statPath || pnpPath.resolvedPath;
        }
      } else if (['realpathSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          result = new Error(`ENOENT: no such file or directory, stat '${args[0]}'`);
        } else {
          args[0] = pnpPath.resolvedPath;
        }
      } else if (['readFileSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          result = new Error(`ENOENT: no such file or directory, open '${args[0]}'`);
        } else {
          args[0] = pnpPath.resolvedPath;
        }
      } else if (['readdirSync'].indexOf(this.method) >= 0) {
        const pnpPath = pathResolver.resolvePath(args[0]);
        if (!pnpPath.resolvedPath) {
          result = new Error(`ENOENT: no such file or directory, scandir '${args[0]}'`);
        } else if (pnpPath.dirList) {
          result = pnpPath.dirList;
        } else {
          args[0] = pnpPath.resolvedPath;
        }
      }
    } catch (e) {
      realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), e.stack + '\n']);
    }
    try {
      if (result instanceof Error)
        throw result;

      const finalResult = result || realFs[this.method].apply(fs, args);
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
