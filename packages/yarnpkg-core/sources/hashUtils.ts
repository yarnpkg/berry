import {PortablePath, xfs, npath} from '@yarnpkg/fslib';
import {createHash, BinaryLike}   from 'crypto';
import globby                     from 'globby';

export function makeHash<T extends string = string>(...args: Array<string | null>): T {
  const hash = createHash(`sha512`);

  for (const arg of args)
    hash.update(arg ? arg : ``);

  return hash.digest(`hex`) as T;
}

export function checksumFile(path: PortablePath) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash(`sha512`);
    const stream = xfs.createReadStream(path);

    stream.on(`data`, chunk => {
      hash.update(chunk);
    });

    stream.on(`error`, error => {
      reject(error);
    });

    stream.on(`end`, () => {
      resolve(hash.digest(`hex`));
    });
  });
}

export async function checksumPattern(pattern: string, {cwd}: {cwd: PortablePath}) {
  const listing = await globby(pattern, {
    cwd: npath.fromPortablePath(cwd),
    expandDirectories: false,
    onlyFiles: false,
  });

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

  return hash;
}
