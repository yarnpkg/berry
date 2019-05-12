import path from 'path';

export type PortablePath = string & { _portable_path: true };

export namespace PortablePath {
  export const root = `/` as PortablePath;

  export const dot = `.` as PortablePath;
}

export type NativePath = string & { _portable_path?: false };

export type Path = PortablePath | NativePath;

export const nativePathUtils: PathUtils<NativePath> = path;

export const portablePathUtils: PathUtils<PortablePath> = path.posix as any;

export interface ParsedPath<P extends Path> {
  root: P;
  dir: P;
  base: string;
  ext: string;
  name: string;
}

export interface FormatInputPathObject<P extends Path> {
  root?: P;
  dir?: P;
  base?: string;
  ext?: string;
  name?: string;
}

export interface PathUtils<P extends Path> {
  normalize(p: P): P;
  join(...paths: P[]): P;
  resolve(...pathSegments: P[]): P;
  isAbsolute(path: P): boolean;
  relative(from: P, to: P): P;
  dirname(p: P): P;
  basename(p: P, ext?: string): string;
  extname(p: P): string;

  readonly sep: P;
  readonly delimiter: string;

  parse(pathString: P): ParsedPath<P>;
  format(pathObject: FormatInputPathObject<P>): P;
}
