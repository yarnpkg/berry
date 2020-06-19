import {getLibzipSync}          from '@yarnpkg/libzip';

import {ppath, npath, Filename} from '../sources/path';
import {ZipOpenFS}              from '../sources';

describe(`ZipOpenFS`, () => {
  it(`can read from a zip file`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    const content = fs.readFileSync(
      ppath.join(
        npath.toPortablePath(__dirname),
        `fixtures/foo.zip/foo.txt` as Filename
      ),
      `utf8`
    );

    expect(content).toEqual(`foo\n`);
  });

  it(`can read from a zip file in a path containing .zip`, () => {
    const fs = new ZipOpenFS({libzip: getLibzipSync()});

    const content = fs.readFileSync(
      ppath.join(
        npath.toPortablePath(__dirname),
        `fixtures/folder.zip/foo.zip/foo.txt` as Filename
      ),
      `utf8`
    );

    expect(content).toEqual(`foo\n`);
  });
});
