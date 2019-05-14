import path from 'path';

export type PortablePath = string & { _portable_path: true };

export const PortablePath = {
  root: `/` as PortablePath,

  dot: `.` as PortablePath,
};

export type NativePath = string & { _portable_path?: false };

export type Filename = (PortablePath & NativePath) & { _filename: false };

export type Path = PortablePath | NativePath;

export const npath: PathUtils<NativePath> = path as any;

export const ppath: PathUtils<PortablePath> = path.posix as any;

export function toFilename(filename: string): Filename {
  if (npath.parse(filename as NativePath).dir !== '' || ppath.parse(filename as PortablePath).dir !== '')
    throw new Error(`Invalid filename: "${filename}"`);

  return filename as any;
}

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
