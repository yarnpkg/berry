import fs                       from 'fs';
import {promisify}              from 'util';

import {NodeFS}                 from '../sources/NodeFS';
import {PosixFS}                from '../sources/PosixFS';
import {Filename, npath, ppath} from '../sources/path';
import {extendFs}               from '../sources';

describe(`patchedFs`, () => {
  it(`in case of no error, give null: fs.stat`, done => {
    const file = ppath.join(npath.toPortablePath(__dirname), `patchedFs.test.ts` as Filename);

    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    patchedFs.stat(file, err => {
      expect(err).toEqual(null);
      done();
    });
  });

  it(`in case of no error, give null: fs.read`, done => {
    const file = ppath.join(npath.toPortablePath(__dirname), `patchedFs.test.ts` as Filename);

    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    const id = patchedFs.openSync(file, `r`);

    patchedFs.read(id, Buffer.alloc(1), 0, 1, 0, err => {
      patchedFs.closeSync(id);
      expect(err).toEqual(null);
      done();
    });
  });

  it(`in case of the parameter of fs.exists is not a string, give false`, done => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));

    patchedFs.exists(undefined as any, exists => {
      expect(exists).toBe(false);
      done();
    });
  });

  it(`matches the util.promisify return shape of node: fs.read`, async () => {
    const patchedFs = extendFs(fs, new PosixFS(new NodeFS()));
    const patchedFsReadAsync = promisify(patchedFs.read);

    const file = ppath.join(npath.toPortablePath(__dirname), `patchedFs.test.ts` as Filename);

    const fd = fs.openSync(file, `r`);

    const bufferFs = Buffer.alloc(16);

    const result = await patchedFsReadAsync(fd, bufferFs, 0, 16, 0);

    expect(typeof result.bytesRead).toBe(`number`);
    expect(Buffer.isBuffer(result.buffer)).toBeTruthy();
  });
});
