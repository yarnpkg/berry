import { patchFs, NodeFS }          from '@berry/fslib';

import fs                           from 'fs';
import os                           from 'os';
import path                         from 'path';

import { NodeModulesFS }            from './NodeModulesFS';

function traceFsCalls() {
  const realFs: { [method: string]: Function } = {};
  const fsMethods = Object.keys(fs).filter(function (key) {
    return key[0] === key[0].toLowerCase() && typeof (fs as any)[key] === 'function'
  });
  fsMethods.forEach(function (method) {
    realFs[method] = (fs as any)[method];
    (fs as any)[method] = traceFsProxy.bind({ method: method });
  });

  function traceFsProxy(this: { method: string }) {
    try {
      const result = realFs[this.method].apply(fs, arguments);
      if (arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0) {
        const dumpedResult = this.method === 'watch' || result === undefined ? '' : ' = ' + JSON.stringify(result instanceof Buffer ? result.toString() : result);
        realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] + dumpedResult + '\n']);
      }
      return result;
    } catch (e) {
      if (arguments.length > 0 && typeof arguments[0] === 'string' && arguments[0].indexOf(process.env.PNPIFY_TRACE) >= 0 && arguments[0].indexOf('pnpify.log') < 0)
        realFs.appendFileSync.apply(fs, [path.join(os.tmpdir(), 'pnpify.log'), this.method + ' ' + arguments[0] +  ' = ' + ((e.message.indexOf('ENOENT') >= 0 || e.message.indexOf('ENOTDIR') >= 0) ? e.message : e.stack) + '\n']);

      throw e;
    }
  }
}

const localFs: typeof fs = {...fs};
const baseFs = new NodeFS(localFs);
const nodeModulesFS = new NodeModulesFS({ baseFs });
patchFs(fs, nodeModulesFS);

if (process.env.PNPIFY_TRACE)
  traceFsCalls();

