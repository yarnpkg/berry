import path from 'path';

export type PortablePath = string & { _portable_path: true };
export type NativePath = string & { _portable_path?: false };

export const PortablePath = {
  root: `/` as PortablePath,
  dot: `.` as PortablePath,
};

export type Filename = (PortablePath & NativePath) & { _filename: false };
export type Path = PortablePath | NativePath;

// Some of the FS functions support file descriptors
export type FSPath<T extends Path> = T | number;

export const npath: PathUtils<NativePath> = path as any;
export const ppath: PathUtils<PortablePath> = path.posix as any;

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
  normalize(p: P): P;
  join(...paths: (P|Filename)[]): P;
  resolve(...pathSegments: (P|Filename)[]): P;
  isAbsolute(path: P): boolean;
  relative(from: P, to: P): P;
  dirname(p: P): P;
  basename(p: P, ext?: string): Filename;
  extname(p: P): string;

  readonly sep: P;
  readonly delimiter: string;

  parse(pathString: P): ParsedPath<P>;
  format(pathObject: FormatInputPathObject<P>): P;
}

const WINDOWS_PATH_REGEXP = /^[a-zA-Z]:.*$/;
const PORTABLE_PATH_REGEXP = /^\/[a-zA-Z]:.*$/;

// Path should look like "/N:/berry/scripts/plugin-pack.js"
// And transform to "N:\berry\scripts\plugin-pack.js"
export function fromPortablePath(p: Path): NativePath {
  if (process.platform !== 'win32')
    return p as NativePath;

  return p.match(PORTABLE_PATH_REGEXP) ? p.substring(1).replace(/\//g, `\\`) : p;
}

// Path should look like "N:/berry/scripts/plugin-pack.js"
// And transform to "/N:/berry/scripts/plugin-pack.js"
export function toPortablePath(p: Path): PortablePath {
  if (process.platform !== 'win32')
    return p as PortablePath;

  return (p.match(WINDOWS_PATH_REGEXP) ? `/${p}` : p).replace(/\\/g, `/`) as PortablePath;
}

export function convertPath<P extends Path>(targetPathUtils: PathUtils<P>, sourcePath: Path): P {
  return (targetPathUtils === npath ? fromPortablePath(sourcePath) : toPortablePath(sourcePath)) as P;
}

export function toFilename(filename: string): Filename {
  if (npath.parse(filename as NativePath).dir !== '' || ppath.parse(filename as PortablePath).dir !== '')
    throw new Error(`Invalid filename: "${filename}"`);

  return filename as any;
}
