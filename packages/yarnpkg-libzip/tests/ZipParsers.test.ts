import {NodeFS, PortablePath}            from '@yarnpkg/fslib';
import {ppath}                           from '@yarnpkg/fslib';
import {createHash}                      from 'crypto';
import fs                                from 'fs';
import globby                            from 'globby';

import {ZipImpl, ZipImplementationClass} from '../sources/ZipFS';
import {JsZipImpl, LibZipImpl}           from '../sources/sync';

// libzip is cloned from https://github.com/nih-at/libzip/tree/3beae9f0ccb6b991d875482ee67b21b418e7d0d5/regress
// go is cloned from https://github.com/golang/go/tree/f062d7b10b276c1b698819f492e4b4754e160ee3/src/archive/zip/testdata

const acceptedDiscrepancies: Record<string, string> = {
  'libzip/zip64-3mf.zip': `no zip64 support`,
  'go/zip64-2.zip': `no zip64 support`,
  'go/zip64.zip': `no zip64 support`,
  'libzip/zip64-in-archive-comment.zip': `no zip64 support`,
  'libzip/incons-eocd64.zip': `no zip64 support`,

  'libzip/zip-in-archive-comment.zip': `
      archive has multiple eocds, first (last in disk) is referencing an offset to central directory, 
      but central directory signature is not there.
      libzip seems to try to find next eocd, but we don't care about broken archives.
      As soon as it throws an error, we are safe.
      https://github.com/nih-at/libzip/commit/ab8715437128c8405b5b8861d2fadf69b94a025b`,

  'libzip/incons-local-filename-long.zip': `different error message`,
  'libzip/junk-at-start.zip': `different error message`,
  'libzip/incons-central-magic-bad2.zip': `different error message`,
  'libzip/incons-central-magic-bad.zip': `different error message`,
  'go/test-prefix.zip': `different error message`,
  'libzip/bogus.zip': `different error message`,
  'go/test-badbase.zip': `different error message`,

  'libzip/multidisk.zip': `
      we are ignoring disk info for performance. 
      Consistent with macos. Go implementation does read disk info but does not use it.`,

  'libzip/extra_field_align_1-ef_ff.zip': `
      go reads it for zip64 and modified date. We don't read extra for performance.
      https://github.com/golang/go/blob/f062d7b10b276c1b698819f492e4b4754e160ee3/src/archive/zip/reader.go#L416`,
  'libzip/extra_field_align_1-ff.zip': `same`,
  'libzip/extra_field_align_2-ef_ff.zip': `same`,
  'libzip/extra_field_align_2-ff.zip': `same`,
  'libzip/extra_field_align_3-ef_ff.zip': `same`,
  'libzip/extra_field_align_3-ff.zip': `same`,
  'libzip/incons-ef-central-size-wrong.zip': `same`,


  'libzip/test-cp437-comment-utf-8.zip': `we dont support not utf8 encoding`,
  'libzip/test-cp437.zip': `we dont support not utf8 encoding`,
  'libzip/testfile-cp437.zip': `we dont support not utf8 encoding`,

  'libzip/incons-file-count-overflow.zip': `
      Idk why libzip throws. Mac os opens it. TODO
  `,
  'libzip/broken.zip': `
      We throw when encryption flags are set.`,
};

function makeSnapshot(ImplCls: ZipImplementationClass, absPath: PortablePath) {
  let zip: ZipImpl | null = null;

  try {
    zip = new ImplCls({path: absPath, baseFs: new NodeFS(), readOnly: true, size: fs.statSync(absPath).size});
  } catch (e) {
    return {error: e.message};
    // throw e
  }

  const entries = zip.getListings();
  return {
    entries: entries.map((entry, ind) => {
      try {
        const {compressionMethod, data} = zip.getFileSource(ind);
        const dataHash = createHash(`sha256`).update(data).digest(`hex`);
        // const dataHash = data.toString()
        const attrs = zip.getExternalAttributes(ind);
        const res: any = {name: entry, ...zip.stat(ind), compressionMethod, dataHash, os: attrs[0], externalAttributes: attrs[1]};
        delete res.mtime;
        return res;
      } catch (e) {
        return {name: entry, errorEntry: e.message};
      }
    }),
    linksCount: zip.getSymlinkCount(),

  };
}
describe(`ZipParsers`, () => {
  const root = ppath.join(__dirname as PortablePath, `testdata`);
  const archives = globby.sync(`**/*.zip`, {cwd: root});
  it.each(archives.map(a => [a]))(`can read from a zip file: %s`, async archive => {
    const absPath = ppath.join(root, archive as PortablePath);
    const update = expect.getState().snapshotState._updateSnapshot;
    if (!update)
      throw new Error(`api changed??`);

    if (acceptedDiscrepancies[archive]) {
      const snapshot = makeSnapshot(LibZipImpl, absPath);
      const snapshot2 = makeSnapshot(JsZipImpl, absPath);
      expect(snapshot).toMatchSnapshot(`libzip`);
      expect(snapshot2).toMatchSnapshot(`jszip`);
      expect(snapshot).not.toEqual(snapshot2);
      return;
    }

    const ImplCls: ZipImplementationClass = update === `all` ? LibZipImpl : JsZipImpl;


    expect(makeSnapshot(ImplCls, absPath)).toMatchSnapshot(`libzip`);
  });
});
