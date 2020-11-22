import {npath, xfs}  from '@yarnpkg/fslib';

import * as tgzUtils from '../sources/tgzUtils';

describe(`tgzUtils`, () => {
  describe(`convertToZip`, () => {
    it(`should be able to convert a tar with a lot of files without getting max callstack`, async () => {
      const data = await xfs.readFilePromise(
        npath.toPortablePath(
          npath.join(__dirname, `fixtures/carbon-icons-svelte-10.21.0.tgz`)
        )
      );
      await tgzUtils.convertToZip(data, {compressionLevel: 0});
    });
  });
});
