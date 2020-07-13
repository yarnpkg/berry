import {URL, fileURLToPath as fileURLToPathImpl, pathToFileURL as pathToFileURLImpl} from 'url';

import * as errors                                                                   from './errors';
import {NativePath, PortablePath, Path, PathUtils, PathLike, PathType, ppath, npath} from './path';

const PROTOCOL = `file:`;

export class BaseFileURL<P extends Path> extends URL {
  declare public protocol: typeof PROTOCOL;

  protected constructor(pathUtils: PathUtils<P>, p: PathLike<P>) {
    super(pathUtils.toFileURL(pathUtils.fromPathLike(p)).toString());
  }
}

export class PortableFileURL extends BaseFileURL<PortablePath> {
  declare _path_type: PathType.Portable;

  constructor(p: PathLike<PortablePath>) {
    super(ppath, p);
  }
}

export class NativeFileURL extends BaseFileURL<NativePath> {
  declare _path_type?: PathType.Native;

  constructor(p: PathLike<NativePath>) {
    super(npath, p);
  }
}

export type FileURL<T extends Path = Path> = T extends PortablePath ? PortableFileURL : NativeFileURL;

export type FileURLConstructor<T extends Path = Path> = T extends PortablePath ? typeof PortableFileURL : typeof NativeFileURL;

// ------------------------------------------------------------------------

// Because Node's URL conversion functions are platform specific, they don't work
// correctly with PortablePaths on Windows, so we have to reimplement them here.
// We only have to implement the posix conversion and we can forward the win32
// conversion to the corresponding Node built-ins.

// Reference: https://github.com/nodejs/node/blob/master/lib/internal/url.js

export function fileURLToPosixPath(url: FileURL<PortablePath>) {
  if (url.protocol !== PROTOCOL)
    throw errors.ERR_INVALID_URL_SCHEME(PROTOCOL);

  if (url.hostname !== ``)
    throw errors.ERR_INVALID_FILE_URL_HOST(process.platform);

  const {pathname} = url;
  for (let n = 0; n < pathname.length; n++) {
    if (pathname[n] === `%`) {
      const third = (pathname.codePointAt(n + 2) ?? 0) | 0x20;
      if (pathname[n + 1] === `2` && third === 102) {
        throw errors.ERR_INVALID_FILE_URL_PATH(`must not include encoded / characters`);
      }
    }
  }
  return decodeURIComponent(pathname) as PortablePath;
}

export function fileURLToPath(url: FileURL): NativePath {
  return process.platform === `win32`
    ? fileURLToPathImpl(url)
    : fileURLToPosixPath(url as FileURL<PortablePath>);
}

export function posixPathToFileURL(p: PortablePath) {
  return Object.assign(new URL(PROTOCOL), {
    pathname: ppath.resolve(p)
      // Preserve trailing slashes
      .replace(/\/?$/, p.endsWith(`/`) ? `/` : ``)
      .replace(/%/g, `%25`)
      // In posix, "/" is a valid character in paths
      .replace(/\\/g, `%5C`)
      .replace(/\n/g, `%0A`)
      .replace(/\r/g, `%0D`)
      .replace(/\t/g, `%09`),
  }) as FileURL<PortablePath>;
}

export function pathToFileURL(p: Path) {
  return (
    process.platform === `win32`
      ? pathToFileURLImpl(p)
      : posixPathToFileURL(p as PortablePath)
  ) as FileURL<NativePath>;
}
