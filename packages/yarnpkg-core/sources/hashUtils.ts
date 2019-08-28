import {NodeFS, PortablePath} from '@yarnpkg/fslib';
import {createHmac}           from 'crypto';

export function makeHash<T>(...args: Array<string | null>): T {
  const hmac = createHmac(`sha512`, `berry`);

  for (const arg of args)
    hmac.update(arg ? arg : ``);

  return hmac.digest(`hex`) as unknown as T;
}

export function checksumFile(path: PortablePath) {
  return new Promise<string>((resolve, reject) => {
    const fs = new NodeFS();

    const hmac = createHmac(`sha512`, `berry`);
    const stream = fs.createReadStream(path, {});

    stream.on(`data`, chunk => {
      hmac.update(chunk);
    });

    stream.on(`error`, error => {
      reject(error);
    });

    stream.on(`end`, () => {
      resolve(hmac.digest(`hex`));
    });
  });
}
