import {getLibzipSync}          from '@yarnpkg/libzip';

import {ppath, npath, Filename} from '../sources/path';
import {ZipOpenFS}              from '../sources';

const ZIP_FILE1 = ppath.join(npath.toPortablePath(__dirname),`fixtures/foo.zip/foo.txt` as Filename);
const ZIP_FILE2 = ppath.join(npath.toPortablePath(__dirname), `fixtures/folder.zip/foo.zip/foo.txt` as Filename);

describe(`ZipOpenFS`, () => {
  it(`can read from a zip file`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    expect(fs.readFileSync(ZIP_FILE1, `utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });

  it(`can read from a zip file in a path containing .zip`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    expect(fs.readFileSync(ZIP_FILE2, `utf8`)).toEqual(`foo\n`);

    fs.discardAndClose();
  });
});
