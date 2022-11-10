import {npath, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

import * as tgzUtils                     from '../sources/tgzUtils';

const here = npath.toPortablePath(__dirname);

describe(`tgzUtils`, () => {
  describe(`convertToZip`, () => {
    it(`should normalize the archives' content when converting them`, async () => {
      const data1 = await xfs.readFilePromise(ppath.join(here, `fixtures/package-unsorted-1.tgz` as PortablePath));
      const data2 = await xfs.readFilePromise(ppath.join(here, `fixtures/package-unsorted-2.tgz` as PortablePath));

      const result1 = await tgzUtils.convertToZip(data1, {compressionLevel: 0});
      const result2 = await tgzUtils.convertToZip(data2, {compressionLevel: 0});

      const path1 = result1.getRealPath();
      const path2 = result2.getRealPath();

      result1.saveAndClose();
      result2.saveAndClose();

      const out1 = await xfs.readFilePromise(path1);
      const out2 = await xfs.readFilePromise(path2);

      expect(out1).toEqual(out2);
    });

    it(`should be able to convert a tar with a lot of files without getting max callstack`, async () => {
      const data = await xfs.readFilePromise(ppath.join(here, `fixtures/carbon-icons-svelte-10.21.0.tgz` as PortablePath));

      await expect(tgzUtils.convertToZip(data, {compressionLevel: 0})).resolves.toBeTruthy();
    });

    it(`should be able to convert a tgz without compression`, async () => {
      const data = await xfs.readFilePromise(ppath.join(here, `fixtures/parse5-0.0.28.tgz` as PortablePath));

      await expect(tgzUtils.convertToZip(data, {compressionLevel: 0})).resolves.toBeTruthy();
    });
  });
});
