import { NodeFS, PortablePath } from '@yarnpkg/fslib';
import { ppath } from '@yarnpkg/fslib';

import { createHash } from 'crypto'

import fs from 'fs';
import globby from 'globby';
import { JsZipImpl, LibZipImpl } from '../sources/sync';
import { ZipImpl, ZipImplementationClass } from '../sources/ZipFS';


describe(`ZipParsers`, () => {
  const archives = globby.sync(`testdata/**/*.zip`, { cwd: __dirname });
  // const archives = ['testdata/test-badbase.zip']
  it.each(archives.map(a => [a]))(`can read from a zip file: %s`, async archive => {
    const absPath = ppath.join(__dirname as PortablePath, archive as PortablePath);
    const update = expect.getState().snapshotState._updateSnapshot
    if (!update) {
      throw new Error('api changed??')
    }
    const ImplCls: ZipImplementationClass = update === 'all' ? LibZipImpl : JsZipImpl

    let zip: ZipImpl | null = null
    let snapshot: any
    try {
      zip = new ImplCls({ path: absPath, baseFs: new NodeFS(), readOnly: true, size: fs.statSync(absPath).size });
    } catch (e) {
      snapshot = { error: e.message }
      // throw e
    }
    if (zip) {
      const entries = zip.getListings();
      snapshot = {
        entries: entries.map((entry, ind) => {
          try {
            const { compressionMethod, data } = zip.getFileSource(ind);
          const dataHash = createHash(`sha256`).update(data).digest(`hex`);
          // const dataHash = data.toString()
          const attrs = zip.getExternalAttributes(ind);
            const res: any = { name: entry, ...zip.stat(ind), compressionMethod, dataHash, os: attrs[0], externalAttributes: attrs[1] };
            delete res.mtime
            return res
          } catch (e) {
            return { name: entry, errorEntry: e.message }
          }
          
        }),
        linksCount: zip.getSymlinkCount(),

      }
    }

    expect(snapshot).toMatchSnapshot();
  })
});
