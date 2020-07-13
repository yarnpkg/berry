import path                                                                                                                                from 'path';
import {URL}                                                                                                                               from 'url';

import {PathBuffer, PathBufferConstructor, NativePathBuffer, PortablePathBuffer}                                                           from './buffer';
import {fileURLToPath, fileURLToPosixPath, pathToFileURL, posixPathToFileURL, FileURL, FileURLConstructor, NativeFileURL, PortableFileURL} from './url';

export enum PathType {
  File,
  Portable,
  Native,
}

export type PortablePath = string & { _path_type: PathType.File | PathType.Portable };
export type NativePath = string & { _path_type?: PathType.File | PathType.Native };

export const PortablePath = {
  root: `/` as PortablePath,
  dot: `.` as PortablePath,
};

export type Filename = string & { _path_type: PathType.File };
export type Path = PortablePath | NativePath;

export const Filename = {
  nodeModules: `node_modules` as Filename,
  manifest: `package.json` as Filename,
  lockfile: `yarn.lock` as Filename,
  rc: `.yarnrc.yml` as Filename,
};

export type PathLike<T extends Path> = T | PathBuffer<T> | FileURL<T>;

export const PathLike = {
  isPathLike(value: unknown): value is PathLike<Path> {
    return typeof value === `string` || Buffer.isBuffer(value) || value instanceof URL;
  },
};

// Some of the FS functions support file descriptors
export type FSPath<T extends Path> = PathLike<T> | number;

export const npath: PathUtils<NativePath> & ConvertUtils = Object.create(path) as any;
export const ppath: PathUtils<PortablePath> = Object.create(path.posix) as any;

npath.cwd = () => process.cwd();
ppath.cwd = () => toPortablePath(process.cwd());

ppath.resolve = (...segments: Array<string>) => path.posix.resolve(ppath.cwd(), ...segments) as PortablePath;

const contains = function <T extends Path>(pathUtils: PathUtils<T>, from: T, to: T) {
  from = pathUtils.normalize(from);
  to = pathUtils.normalize(to);

  if (from === to)
    return `.` as T;

  if (!from.endsWith(pathUtils.sep))
    from = (from + pathUtils.sep) as T;

  if (to.startsWith(from)) {
    return to.slice(from.length) as T;
  } else {
    return null;
  }
};

npath.fromPortablePath = fromPortablePath;
npath.toPortablePath = toPortablePath;

npath.contains = (from: NativePath, to: NativePath) => contains(npath, from, to);
ppath.contains = (from: PortablePath, to: PortablePath) => contains(ppath, from, to);

npath.FileURL = NativeFileURL;
ppath.FileURL = PortableFileURL;

npath.fromFileURL = (url: FileURL<NativePath>) => fileURLToPath(url);
ppath.fromFileURL = (url: FileURL<PortablePath>) => fileURLToPosixPath(url);

npath.toFileURL = (p: NativePath) => pathToFileURL(p);
ppath.toFileURL = (p: PortablePath) => posixPathToFileURL(p);

npath.PathBuffer = NativePathBuffer;
ppath.PathBuffer = PortablePathBuffer;

npath.fromPathBuffer = (buffer: PathBuffer<NativePath>, encoding?: BufferEncoding) => buffer.toString(encoding);
ppath.fromPathBuffer = (buffer: PathBuffer<PortablePath>, encoding?: BufferEncoding) => buffer.toString(encoding);

npath.toPathBuffer = (p: NativePath, encoding?: BufferEncoding) => new NativePathBuffer(p, encoding);
ppath.toPathBuffer = (p: PortablePath, encoding?: BufferEncoding) => new PortablePathBuffer(p, encoding);

npath.fromPathLike = (pathLike: PathLike<NativePath>) => fromPathLike(npath, pathLike);
ppath.fromPathLike = (pathLike: PathLike<PortablePath>) => fromPathLike(ppath, pathLike);

export interface ParsedPath<P extends Path> {
  root: P;
  dir: P;
  base: Filename;
  ext: string;
  name: Filename;
}

export interface FormatInputPathObject<P extends Path> {
  root?: P;
  dir?: P;
  base?: Filename;
  ext?: string;
  name?: Filename;
}

export interface PathUtils<P extends Path> {
  cwd(): P;

  normalize(p: P): P;
  join(...paths: Array<P|Filename>): P;
  resolve(...pathSegments: Array<P|Filename>): P;
  isAbsolute(path: P): boolean;
  relative(from: P, to: P): P;
  dirname(p: P): P;
  basename(p: P, ext?: string): Filename;
  extname(p: P): string;

  readonly sep: P;
  readonly delimiter: string;

  parse(pathString: P): ParsedPath<P>;
  format(pathObject: FormatInputPathObject<P>): P;

  contains(from: P, to: P): P | null;

  PathBuffer: PathBufferConstructor<P>;
  fromPathBuffer(buffer: PathBuffer<P>, encoding?: BufferEncoding): P;
  toPathBuffer(p: P, encoding?: BufferEncoding): PathBuffer<P>;

  FileURL: FileURLConstructor<P>;
  fromFileURL(url: FileURL<P>): P;
  toFileURL(p: P): FileURL<P>;

  fromPathLike(pathLike: PathLike<P>): P;
}

export interface ConvertUtils {
  fromPortablePath: (p: Path) => NativePath;
  toPortablePath: (p: Path) => PortablePath;
}

const WINDOWS_PATH_REGEXP = /^([a-zA-Z]:.*)$/;
const UNC_WINDOWS_PATH_REGEXP = /^\\\\(\.\\)?(.*)$/;

const PORTABLE_PATH_REGEXP = /^\/([a-zA-Z]:.*)$/;
const UNC_PORTABLE_PATH_REGEXP = /^\/unc\/(\.dot\/)?(.*)$/;

// Path should look like "/N:/berry/scripts/plugin-pack.js"
// And transform to "N:\berry\scripts\plugin-pack.js"
function fromPortablePath(p: Path): NativePath {
  if (process.platform !== `win32`)
    return p as NativePath;

  if (p.match(PORTABLE_PATH_REGEXP))
    p = p.replace(PORTABLE_PATH_REGEXP, `$1`);
  else if (p.match(UNC_PORTABLE_PATH_REGEXP))
    p = p.replace(UNC_PORTABLE_PATH_REGEXP, (match, p1, p2) => `\\\\${p1 ? `.\\` : ``}${p2}`);
  else
    return p as NativePath;

  return p.replace(/\//g, `\\`);
}

// Path should look like "N:/berry/scripts/plugin-pack.js"
// And transform to "/N:/berry/scripts/plugin-pack.js"
function toPortablePath(p: Path): PortablePath {
  if (process.platform !== `win32`)
    return p as PortablePath;

  if (p.match(WINDOWS_PATH_REGEXP))
    p = p.replace(WINDOWS_PATH_REGEXP, `/$1`);
  else if (p.match(UNC_WINDOWS_PATH_REGEXP))
    p = p.replace(UNC_WINDOWS_PATH_REGEXP, (match, p1, p2) => `/unc/${p1 ? `.dot/` : ``}${p2}`);

  return p.replace(/\\/g, `/`) as PortablePath;
}

export function convertPath<P extends Path>(targetPathUtils: PathUtils<P>, sourcePath: Path): P {
  return (targetPathUtils === (npath as PathUtils<NativePath>) ? fromPortablePath(sourcePath) : toPortablePath(sourcePath)) as P;
}

export function toFilename(filename: string): Filename {
  if (npath.parse(filename as NativePath).dir !== `` || ppath.parse(filename as PortablePath).dir !== ``)
    throw new Error(`Invalid filename: "${filename}"`);

  return filename as any;
}

export function fromPathLike<P extends Path>(pathUtils: PathUtils<P>, pathLike: PathLike<P>): P {
  const path = Buffer.isBuffer(pathLike)
    ? pathLike.toString()
    : pathLike instanceof URL
      ? pathUtils.fromFileURL(pathLike)
      : pathLike;

  return convertPath(pathUtils, path);
}
