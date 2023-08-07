import {npath, xfs}  from '@yarnpkg/fslib';
import pLimit        from 'p-limit';

import * as tgzUtils from '../sources/tgzUtils';

describe(`tgzUtils`, () => {
  describe(`convertToZip`, () => {
    it(`should be able to convert a tar with a lot of files without getting max callstack`, async () => {
      const data = await xfs.readFilePromise(
        npath.toPortablePath(
          npath.join(__dirname, `fixtures/carbon-icons-svelte-10.21.0.tgz`),
        ),
      );
      await expect(tgzUtils.convertToZip(data, {compressionLevel: 0, poolSize: pLimit(2)})).resolves.toBeTruthy();
    });

    it(`should be able to convert a tgz without compression`, async () => {
      const data = await xfs.readFilePromise(
        npath.toPortablePath(
          npath.join(__dirname, `fixtures/parse5-0.0.28.tgz`),
        ),
      );
      await expect(tgzUtils.convertToZip(data, {compressionLevel: 0, poolSize: pLimit(2)})).resolves.toBeTruthy();
    });
  });
});
