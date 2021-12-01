import fs from 'fs';

//#region ESM to CJS support
/*
  In order to import CJS files from ESM Node does some translating
  internally[1]. This translator calls an unpatched `readFileSync`[2]
  which itself calls an internal `tryStatSync`[3] which calls
  `binding.fstat`[4]. A PR[5] has been made to use the monkey-patchable
  `fs.readFileSync` but assuming that wont be merged this region of code
  patches that final `binding.fstat` call.

  1: https://github.com/nodejs/node/blob/d872aaf1cf20d5b6f56a699e2e3a64300e034269/lib/internal/modules/esm/translators.js#L177-L277
  2: https://github.com/nodejs/node/blob/d872aaf1cf20d5b6f56a699e2e3a64300e034269/lib/internal/modules/esm/translators.js#L240
  3: https://github.com/nodejs/node/blob/1317252dfe8824fd9cfee125d2aaa94004db2f3b/lib/fs.js#L452
  4: https://github.com/nodejs/node/blob/1317252dfe8824fd9cfee125d2aaa94004db2f3b/lib/fs.js#L403
  5: https://github.com/nodejs/node/pull/39513
*/

const binding = (process as any).binding(`fs`) as {
  fstat: (fd: number, useBigint: false, req: any, ctx: object) => Float64Array;
};
const originalfstat = binding.fstat;

const ZIP_FD = 0x80000000;
binding.fstat = function(...args) {
  const [fd, useBigint, req] = args;
  if ((fd & ZIP_FD) !== 0 && useBigint === false && req === undefined) {
    try {
      const stats = fs.fstatSync(fd);
      // The reverse of this internal util
      // https://github.com/nodejs/node/blob/8886b63cf66c29d453fdc1ece2e489dace97ae9d/lib/internal/fs/utils.js#L542-L551
      return new Float64Array([
        stats.dev,
        stats.mode,
        stats.nlink,
        stats.uid,
        stats.gid,
        stats.rdev,
        stats.blksize,
        stats.ino,
        stats.size,
        stats.blocks,
        // atime sec
        // atime ns
        // mtime sec
        // mtime ns
        // ctime sec
        // ctime ns
        // birthtime sec
        // birthtime ns
      ]);
    } catch {}
  }

  return originalfstat.apply(this, args);
};
//#endregion
