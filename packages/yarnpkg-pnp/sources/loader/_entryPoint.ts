import {FakeFS, NodeFS, NativePath, PortablePath, VirtualFS, ZipOpenFS} from '@yarnpkg/fslib';
import fs                                                               from 'fs';
import Module                                                           from 'module';
import path                                                             from 'path';
import StringDecoder                                                    from 'string_decoder';

import {RuntimeState, PnpApi}                                           from '../types';

import {applyPatch}                                                     from './applyPatch';
import {hydrateRuntimeState}                                            from './hydrateRuntimeState';
import {MakeApiOptions, makeApi}                                        from './makeApi';

declare var __non_webpack_module__: NodeModule;
declare var $$SETUP_STATE: (hrs: typeof hydrateRuntimeState, basePath?: NativePath) => RuntimeState;

const IS_PRELOADED = __non_webpack_module__.parent && __non_webpack_module__.parent.id === `internal/preload`;
const IS_MAIN = process.mainModule === __non_webpack_module__;

// We must copy the fs into a local, because otherwise
// 1. we would make the NodeFS instance use the function that we patched (infinite loop)
// 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
const localFs: typeof fs = {...fs};
const nodeFs = new NodeFS(localFs);

const defaultRuntimeState = $$SETUP_STATE(hydrateRuntimeState);
const defaultPnpapiResolution = path.resolve(__dirname, __filename);

let patchFsLayer: FakeFS<PortablePath> = new ZipOpenFS({baseFs: nodeFs, readOnlyArchives: true});
for (const virtualRoot of defaultRuntimeState.virtualRoots)
  patchFsLayer = new VirtualFS(virtualRoot, {baseFs: patchFsLayer});

// If the PnP API is preloaded we can just use the "real" fs module because
// it'll have been patched to support in-zip loading (and possibly extended by
// other tools, such as PnPify). Otherwise we use our own patched FS in order to
// be sure that `resolveUnqualified` and `resolveRequest` work (note that in
// this case, tools like PnPify won't be able to affect the file detection).
const defaultFsLayer = IS_PRELOADED
  ? new NodeFS(fs)
  : patchFsLayer;

const defaultApi = Object.assign(makeApi(defaultRuntimeState, {
  fakeFs: new NodeFS(fs),
  pnpapiResolution: defaultPnpapiResolution,
}), {
  /**
   * Can be used to generate a different API than the default one (for example
   * to map it on `/` rather than the local directory path, or to use a
   * different FS layer than the default one).
   */
  makeApi: ({
    basePath = undefined,
    fakeFs = new NodeFS(fs),
    pnpapiResolution = defaultPnpapiResolution,
    ...rest
  }: Partial<MakeApiOptions> & {basePath?: NativePath}) => {
    const apiRuntimeState = typeof basePath !== `undefined`
      ? $$SETUP_STATE(hydrateRuntimeState, basePath)
      : defaultRuntimeState;

    return makeApi(apiRuntimeState, {
      fakeFs,
      pnpapiResolution,
      ...rest,
    });
  },
  /**
   * Will inject the specified API into the environment, monkey-patching FS. Is
   * automatically called when the hook is loaded through `--require`.
   */
  setup: (api?: PnpApi) => {
    applyPatch(api || defaultApi.makeApi({
      fakeFs: new NodeFS(fs),
    }), {
      fakeFs: patchFsLayer,
    });
  },
});

// eslint-disable-next-line arca/no-default-export
export default defaultApi;

if (IS_PRELOADED) {
  defaultApi.setup();

  if (__non_webpack_module__.filename) {
    // We delete it from the cache in order to support the case where the CLI resolver is invoked from "yarn run"
    // It's annoying because it might cause some issues when the file is multiple times in NODE_OPTIONS, but it shouldn't happen anyway.

    // @ts-ignore
    delete Module._cache[__non_webpack_module__.filename];
  }
}

// @ts-ignore
if (IS_MAIN) {
  const reportError = (code: string, message: string, data: Object) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = (resolution: string | null) => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request: string, issuer: string) => {
    try {
      reportSuccess(defaultApi.resolveRequest(request, issuer));
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
