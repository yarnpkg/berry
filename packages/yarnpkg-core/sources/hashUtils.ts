import {NodeFS, PortablePath} from '@yarnpkg/fslib';
import {createHash}           from 'crypto';

export function makeHash<T extends string = string>(...args: Array<string | null>): T {
  const hash = createHash(`sha512`);

  for (const arg of args)
    hash.update(arg ? arg : ``);

  return hash.digest(`hex`) as T;
}

export function checksumFile(path: PortablePath) {
  return new Promise<string>((resolve, reject) => {
    const fs = new NodeFS();

    const hash = createHash(`sha512`);
    const stream = fs.createReadStream(path, {});

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
