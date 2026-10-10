import {NodeFS, PortablePath, ppath, xfs} from '@yarnpkg/fslib';
import fs                                 from 'fs';

import {ZipFS}                            from '../sources/ZipFS';
import {JsZipImpl, LibZipImpl}            from '../sources/sync';

// Opt-in because it allocates several GB. HEAVY_ZIP_TEST isn't YARN_-prefixed
// on purpose: Yarn would reject an unknown YARN_* var as a config setting.
const HEAVY = process.env.HEAVY_ZIP_TEST === `1` || process.env.HEAVY_ZIP_TEST === `true`;
const heavyIt = HEAVY ? it : it.skip;

function buildLargeArchive(dir: PortablePath, entrySize: number): PortablePath {
  const archive = ppath.join(dir, `large.zip` as PortablePath);

  const payload = Buffer.allocUnsafe(entrySize);
  for (let i = 0; i + 4 <= entrySize; i += 4)
    payload.writeUInt32LE((Math.random() * 0xffffffff) >>> 0, i);

  const zipFs = new ZipFS(archive, {create: true, level: 0});
  zipFs.writeFileSync(`/payload.bin` as PortablePath, payload);
  zipFs.saveAndClose();

  return archive;
}

describe(`ZipImpl memory behavior`, () => {
  heavyIt(`LibZipImpl exhausts the shared WASM heap under accumulated opens, JsZipImpl does not`, () => {
    const dir = xfs.mktempSync();
    const entrySize = 192 * 1024 * 1024;
    const archive = buildLargeArchive(dir, entrySize);
    const size = fs.statSync(archive).size;

    const openOne = (ImplCls: typeof LibZipImpl | typeof JsZipImpl) =>
      new ImplCls({path: archive, baseFs: new NodeFS(), readOnly: true, size});

    const libInstances: Array<LibZipImpl> = [];
    let libError: Error | undefined;
    try {
      for (let i = 0; i < 24; i++) {
        const impl = openOne(LibZipImpl) as LibZipImpl;
        libInstances.push(impl);
        impl.getFileSource(impl.locate(`payload.bin`));
      }
    } catch (error) {
      libError = error as Error;
    } finally {
      for (const impl of libInstances) {
        try {
          impl.discard();
        } catch {}
      }
    }

    expect(libError).toBeDefined();
    expect(libError!.message).toMatch(/Malloc failure|Invalid argument|allocate/i);

    for (let i = 0; i < 24; i++) {
      const impl = openOne(JsZipImpl) as JsZipImpl;
      try {
        const {data} = impl.getFileSource(impl.locate(`payload.bin`));
        expect(data.length).toBe(entrySize);
      } finally {
        impl.discard();
      }
    }
  });
});
