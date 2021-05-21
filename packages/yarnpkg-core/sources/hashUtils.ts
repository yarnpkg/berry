import {PortablePath, xfs, npath, FakeFS} from '@yarnpkg/fslib';
import {createHash, BinaryLike}           from 'crypto';
import globby                             from 'globby';

export function makeHash<T extends string = string>(...args: Array<BinaryLike | null>): T {
  const hash = createHash(`sha512`);

  let acc = ``;
  for (const arg of args) {
    if (typeof arg === `string`) {
      acc += arg;
    } else if (arg) {
      if (acc) {
        hash.update(acc);
        acc = ``;
      }

      hash.update(arg);
    }
  }

  if (acc)
    hash.update(acc);

  return hash.digest(`hex`) as T;
}

export async function checksumFile(path: PortablePath, {baseFs, algorithm}: {baseFs: FakeFS<PortablePath>, algorithm: string} = {baseFs: xfs, algorithm: `sha512`}) {
  const fd = await baseFs.openPromise(path, `r`);

  try {
    const CHUNK_SIZE = 65536;
    const chunk = Buffer.allocUnsafeSlow(CHUNK_SIZE);

    const hash = createHash(algorithm);

    let bytesRead = 0;
    while ((bytesRead = await baseFs.readPromise(fd, chunk, 0, CHUNK_SIZE)) !== 0)
      hash.update(bytesRead === CHUNK_SIZE ? chunk : chunk.slice(0, bytesRead));

    return hash.digest(`hex`);
  } finally {
    await baseFs.closePromise(fd);
  }
}

export async function checksumPattern(pattern: string, {cwd}: {cwd: PortablePath}) {
  // Note: We use a two-pass glob instead of using the expandDirectories option
  // from globby, because the native implementation is broken.
  //
  // Ref: https://github.com/sindresorhus/globby/issues/147

  const dirListing = await globby(pattern, {
    cwd: npath.fromPortablePath(cwd),
    expandDirectories: false,
    onlyDirectories: true,
    unique: true,
  });

  const dirPatterns = dirListing.map(entry => {
    return `${entry}/**/*`;
  });

  const listing = await globby([pattern, ...dirPatterns], {
    cwd: npath.fromPortablePath(cwd),
    expandDirectories: false,
    onlyFiles: false,
    unique: true,
  });

  listing.sort();

  const hashes = await Promise.all(listing.map(async entry => {
    const parts: Array<Buffer> = [Buffer.from(entry)];

    const p = npath.toPortablePath(entry);
    const stat = await xfs.lstatPromise(p);

    if (stat.isSymbolicLink())
      parts.push(Buffer.from(await xfs.readlinkPromise(p)));
    else if (stat.isFile())
      parts.push(await xfs.readFilePromise(p));

    return parts.join(`\u0000`);
  }));

  const hash = createHash(`sha512`);
  for (const sub of hashes)
    hash.update(sub);

  return hash.digest(`hex`);
}
