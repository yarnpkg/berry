import {URL, fileURLToPath} from 'url';
import {inspect}            from 'util';

import {FakeFS}             from './FakeFS';
import {ProxiedFS}          from './ProxiedFS';
import {npath, NativePath}  from './path';

/**
 * Adds support for file URLs and Buffers to the wrapped `baseFs`, but *not* inside the typings.
 *
 * Only exists for compatibility with Node's behavior.
 *
 * Automatically wraps all FS instances passed to `patchFs` & `extendFs`.
 *
 * Don't use it!
 */
export class NodePathFS extends ProxiedFS<NativePath, NativePath> {
  protected readonly baseFs: FakeFS<NativePath>;

  constructor(baseFs: FakeFS<NativePath>) {
    super(npath);

    this.baseFs = baseFs;
  }

  protected mapFromBase(path: NativePath) {
    return path;
  }

  protected mapToBase(path: NativePath | URL | Buffer) {
    if (typeof path === `string`)
      return path;

    if (path instanceof URL)
      return fileURLToPath(path);

    if (Buffer.isBuffer(path)) {
      const str = path.toString();
      if (Buffer.byteLength(str) !== path.byteLength)
        throw new Error(`Non-utf8 buffers are not supported at the moment. Please upvote the following issue if you encounter this error: https://github.com/yarnpkg/berry/issues/4942`);

      return str;
    }

    throw new Error(`Unsupported path type: ${inspect(path)}`);
  }
}
