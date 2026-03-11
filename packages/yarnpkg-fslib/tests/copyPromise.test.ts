import {NodeFS}                                    from '../sources/NodeFS';
import {xfs, ppath, Filename} from '../sources';
import {setupCopyIndex}                            from '../sources';

const nodeFs = new NodeFS();

function makeLinkError(code: string, syscall = `link`): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`${code}: simulated link failure`);
  err.code = code;
  err.syscall = syscall;
  return err;
}

describe(`copyPromise`, () => {
  describe(`HardlinkFromIndex fallback`, () => {
    async function setupIndexEnv() {
      const tmpdir = await xfs.mktempPromise();
      const indexPath = ppath.join(tmpdir, `index` as Filename);
      await setupCopyIndex(nodeFs, {indexPath});

      const sourceDir = ppath.join(tmpdir, `source` as Filename);
      const destDir = ppath.join(tmpdir, `dest` as Filename);

      await xfs.mkdirPromise(sourceDir);
      await xfs.mkdirPromise(destDir);

      const sourceFile = ppath.join(sourceDir, `file.txt` as Filename);
      await xfs.writeFilePromise(sourceFile, `Hello World`);

      return {tmpdir, indexPath, sourceDir, destDir, sourceFile};
    }

    it(`should hardlink from index under normal conditions`, async () => {
      const {indexPath, sourceFile, destDir} = await setupIndexEnv();
      const destFile = ppath.join(destDir, `file.txt` as Filename);

      await nodeFs.copyPromise(destFile, sourceFile, {
        linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
        stableTime: true,
        overwrite: true,
        stableSort: true,
      });

      await expect(xfs.readFilePromise(destFile, `utf8`)).resolves.toBe(`Hello World`);

      const destStat = await xfs.statPromise(destFile);
      expect(destStat.nlink).toBeGreaterThan(1);
    });

    for (const errorCode of [`EXDEV`, `EMLINK`]) {
      it(`should fall back to copy on ${errorCode}`, async () => {
        const {indexPath, sourceFile, destDir} = await setupIndexEnv();
        const destFile = ppath.join(destDir, `file.txt` as Filename);

        const originalLink = nodeFs.linkPromise.bind(nodeFs);
        let linkCallCount = 0;
        const spy = jest.spyOn(nodeFs, `linkPromise`).mockImplementation(async (existingPath, newPath) => {
          linkCallCount++;
          // Allow the first link (temp → index), fail the second (index → destination)
          if (linkCallCount <= 1)
            return originalLink(existingPath, newPath);
          throw makeLinkError(errorCode);
        });

        try {
          await nodeFs.copyPromise(destFile, sourceFile, {
            linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
            stableTime: true,
            overwrite: true,
            stableSort: true,
          });

          await expect(xfs.readFilePromise(destFile, `utf8`)).resolves.toBe(`Hello World`);

          // Destination should be a copy, not a hard link (nlink === 1)
          const destStat = await xfs.statPromise(destFile);
          expect(destStat.nlink).toBe(1);
        } finally {
          spy.mockRestore();
        }
      });
    }

    it(`should fall back to copy on UNKNOWN with link syscall (NTFS limit)`, async () => {
      const {indexPath, sourceFile, destDir} = await setupIndexEnv();
      const destFile = ppath.join(destDir, `file.txt` as Filename);

      const originalLink = nodeFs.linkPromise.bind(nodeFs);
      let linkCallCount = 0;
      const spy = jest.spyOn(nodeFs, `linkPromise`).mockImplementation(async (existingPath, newPath) => {
        linkCallCount++;
        if (linkCallCount <= 1)
          return originalLink(existingPath, newPath);
        throw makeLinkError(`UNKNOWN`, `link`);
      });

      try {
        await nodeFs.copyPromise(destFile, sourceFile, {
          linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
          stableTime: true,
          overwrite: true,
          stableSort: true,
        });

        await expect(xfs.readFilePromise(destFile, `utf8`)).resolves.toBe(`Hello World`);
      } finally {
        spy.mockRestore();
      }
    });

    it(`should fall back to copy on EPERM with link syscall`, async () => {
      const {indexPath, sourceFile, destDir} = await setupIndexEnv();
      const destFile = ppath.join(destDir, `file.txt` as Filename);

      const originalLink = nodeFs.linkPromise.bind(nodeFs);
      let linkCallCount = 0;
      const spy = jest.spyOn(nodeFs, `linkPromise`).mockImplementation(async (existingPath, newPath) => {
        linkCallCount++;
        if (linkCallCount <= 1)
          return originalLink(existingPath, newPath);
        throw makeLinkError(`EPERM`, `link`);
      });

      try {
        await nodeFs.copyPromise(destFile, sourceFile, {
          linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
          stableTime: true,
          overwrite: true,
          stableSort: true,
        });

        await expect(xfs.readFilePromise(destFile, `utf8`)).resolves.toBe(`Hello World`);
      } finally {
        spy.mockRestore();
      }
    });

    it(`should NOT fall back on UNKNOWN without link syscall`, async () => {
      const {indexPath, sourceFile, destDir} = await setupIndexEnv();
      const destFile = ppath.join(destDir, `file.txt` as Filename);

      const originalLink = nodeFs.linkPromise.bind(nodeFs);
      let linkCallCount = 0;
      const spy = jest.spyOn(nodeFs, `linkPromise`).mockImplementation(async (existingPath, newPath) => {
        linkCallCount++;
        if (linkCallCount <= 1)
          return originalLink(existingPath, newPath);
        throw makeLinkError(`UNKNOWN`, `open`);
      });

      try {
        await expect(
          nodeFs.copyPromise(destFile, sourceFile, {
            linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
            stableTime: true,
            overwrite: true,
            stableSort: true,
          }),
        ).rejects.toMatchObject({code: `UNKNOWN`});
      } finally {
        spy.mockRestore();
      }
    });

    it(`should propagate non-link errors`, async () => {
      const {indexPath, sourceFile, destDir} = await setupIndexEnv();
      const destFile = ppath.join(destDir, `file.txt` as Filename);

      const originalLink = nodeFs.linkPromise.bind(nodeFs);
      let linkCallCount = 0;
      const spy = jest.spyOn(nodeFs, `linkPromise`).mockImplementation(async (existingPath, newPath) => {
        linkCallCount++;
        if (linkCallCount <= 1)
          return originalLink(existingPath, newPath);
        throw makeLinkError(`EACCES`, `link`);
      });

      try {
        await expect(
          nodeFs.copyPromise(destFile, sourceFile, {
            linkStrategy: {type: `HardlinkFromIndex`, indexPath, autoRepair: true},
            stableTime: true,
            overwrite: true,
            stableSort: true,
          }),
        ).rejects.toMatchObject({code: `EACCES`});
      } finally {
        spy.mockRestore();
      }
    });
  });
});
