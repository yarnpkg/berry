import {NodeFS, ZipOpenFS}             from '@berry/fslib';
import fs                              from 'fs';
import Module                          from 'module';
import path                            from 'path';
import StringDecoder                   from 'string_decoder';

import {RuntimeState, SerializedState} from '../types';

import {applyPatch}                    from './applyPatch';
import {hydrateRuntimeState}           from './hydrateRuntimeState';
import {makeApi}                       from './makeApi';

declare var __non_webpack_module__: NodeModule;
declare var $$SETUP_STATE: (hrs: typeof hydrateRuntimeState) => RuntimeState;

// We must copy the fs into a local, because otherwise
// 1. we would make the NodeFS instance use the function that we patched (infinite loop)
// 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
const localFs: typeof fs = {...fs};
const nodeFs = new NodeFS(localFs);

const zipOpenFs = new ZipOpenFS({baseFs: nodeFs});

module.exports = makeApi($$SETUP_STATE(hydrateRuntimeState), {
  compatibilityMode: true,
  pnpapiResolution: path.resolve(__dirname, __filename),
  fakeFs: zipOpenFs,
});

if (__non_webpack_module__.parent && __non_webpack_module__.parent.id === 'internal/preload') {
  applyPatch(module.exports, {
    compatibilityMode: true,
    fakeFs: zipOpenFs,
  });

  if (__non_webpack_module__.filename) {
    // We delete it from the cache in order to support the case where the CLI resolver is invoked from "yarn run"
    // It's annoying because it might cause some issues when the file is multiple times in NODE_OPTIONS, but it shouldn't happen anyway.
    delete Module._cache[__non_webpack_module__.filename];
  }
}

// @ts-ignore
if (process.mainModule === __non_webpack_module__) {
  const reportError = (code: string, message: string, data: Object) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = (resolution: string | null) => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request: string, issuer: string) => {
    try {
      reportSuccess(module.exports.resolveRequest(request, issuer));
    } catch (error) {
      reportError(error.code, error.message, error.data);
    }
  };

  const processRequest = (data: string) => {
    try {
      const [request, issuer] = JSON.parse(data);
      processResolution(request, issuer);
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data);
    }
  };

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`);
      process.exitCode = 64; /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3]);
    }
  } else {
    let buffer = '';
    const decoder = new StringDecoder.StringDecoder();

    process.stdin.on('data', chunk => {
      buffer += decoder.write(chunk);

      do {
        const index = buffer.indexOf('\n');
        if (index === -1)
          break;

        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        processRequest(line);
      } while (true);
    });
  }
}
