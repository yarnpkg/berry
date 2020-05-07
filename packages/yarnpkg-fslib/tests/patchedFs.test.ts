import fs                       from 'fs';

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
});
