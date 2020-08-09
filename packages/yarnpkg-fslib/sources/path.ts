import path from 'path';

enum PathType {
  File,
  Portable,
  Native,
}

export type Portable = {_path_type: PathType.Portable | PathType.File};
type _Native = {_path_type: PathType.Native | PathType.File};
export type Native = _Native | void;

enum PathRelativity {
  Absolute,
  Relative,
}

export type Absolute = {_path_relativity: PathRelativity.Absolute};
export type Relative = {_path_relativity: PathRelativity.Relative};

export type Flags = Portable | Native | Absolute | Relative | unknown;

export type Path<F extends Flags = (Portable | Native)> = string & ([void] extends [F] ? {_flags?: F} : {_flags: F});
export type GetFlags<P extends Path> = P extends Path<infer F> ? F : never;

export type PortablePath = Path<Portable>;
export type NativePath = Path<Native>;

export const PortablePath = {
  root: `/` as Path<Portable & Absolute>,
  dot: `.` as Path<Portable & Relative>,
};

export type Filename = Path<{_path_type: PathType.File} & Relative>;

export const Filename = {
  nodeModules: `node_modules` as Filename,
  manifest: `package.json` as Filename,
  lockfile: `yarn.lock` as Filename,
  pnpJs: `.pnp.js` as Filename,
  rc: `.yarnrc.yml` as Filename,
};

// Some of the FS functions support file descriptors
export type FSPath<T extends Path> = T | number;

export const npath: PathUtils<Path<Native>, Path<Native & Absolute>, Path<Native & Relative>> & ConvertUtils = Object.create(path) as any;
export const ppath: PathUtils<PortablePath, Path<Portable & Absolute>, Path<Portable & Relative>> = Object.create(path.posix) as any;

npath.cwd = () => process.cwd() as Path<Native & Absolute>;
ppath.cwd = () => toPortablePath(process.cwd() as Path<Portable & Absolute>);

ppath.resolve = (...segments: Array<PortablePath | Filename>) => {
  if (segments.length > 0 && ppath.isAbsolute(segments[0])) {
    return path.posix.resolve(...segments) as Path<Portable & Absolute>;
  } else {
    return path.posix.resolve(ppath.cwd(), ...segments) as Path<Portable & Absolute>;
  }
};

const contains = function <T extends PortablePath|NativePath>(pathUtils: PathUtils<T>, from: T, to: T) {
  from = pathUtils.normalize(from);
  to = pathUtils.normalize(to);

  if (from === to)
    return `.` as MakeRelative<T>;

  if (!from.endsWith(pathUtils.sep))
    from = (from + pathUtils.sep) as T;

  if (to.startsWith(from)) {
    return to.slice(from.length) as MakeRelative<T>;
  } else {
    return null;
  }
};

npath.fromPortablePath = fromPortablePath;
npath.toPortablePath = toPortablePath;

npath.contains = (from: NativePath, to: NativePath) => contains(npath, from, to);
ppath.contains = (from: PortablePath, to: PortablePath) => contains(ppath, from, to);

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

export type MakeAbsolute<P extends Path> = P & Path<(P extends PortablePath ? Portable : Native) & Absolute>;
export type MakeRelative<P extends Path> = P & Path<(P extends PortablePath ? Portable : Native) & Relative>;

export interface PathUtils<P extends Path, AP extends P = MakeAbsolute<P>, RP extends P = MakeRelative<P>> {
  cwd(): AP;

  normalize<T extends P>(p: T): T;

  join(initial: AP, ...paths: Array<P|Filename>): AP;
  join(initial: RP | Filename, ...paths: Array<P|Filename>): RP;
  join(...paths: Array<P|Filename>): P;
  resolve(...pathSegments: Array<P|Filename>): AP;
  isAbsolute(path: P): path is AP;
  relative(from: P, to: P): RP;
  dirname<T extends P>(p: T): T;
  basename(p: P, ext?: string): Filename;
  extname(p: P): string;

  readonly sep: AP;
  readonly delimiter: string;

  parse<T extends P>(pathString: T): ParsedPath<T>;
  format<T extends P>(pathObject: FormatInputPathObject<T>): T;
  contains(from: P, to: P): RP | null;
}

export interface ConvertUtils {
  fromPortablePath<P extends Path>(p: P): Path<Exclude<GetFlags<P>, Portable> & Native>;
  toPortablePath<P extends Path>(p: P): Path<Exclude<GetFlags<P>, Native> & Portable>;
}

const WINDOWS_PATH_REGEXP = /^([a-zA-Z]:.*)$/;
const UNC_WINDOWS_PATH_REGEXP = /^\\\\(\.\\)?(.*)$/;

const PORTABLE_PATH_REGEXP = /^\/([a-zA-Z]:.*)$/;
const UNC_PORTABLE_PATH_REGEXP = /^\/unc\/(\.dot\/)?(.*)$/;

// Path should look like "/N:/berry/scripts/plugin-pack.js"
// And transform to "N:\berry\scripts\plugin-pack.js"
function fromPortablePath(p: Path<Absolute>): Path<Absolute & Native>;
function fromPortablePath(p: Path<Relative>): Path<Relative & Native>;
function fromPortablePath(p: Path<unknown>): NativePath;
function fromPortablePath(p: Path<unknown>): NativePath {
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
function toPortablePath(p: Path<Absolute>): Path<Absolute & Portable>;
function toPortablePath(p: Path<Relative>): Path<Relative & Portable>;
function toPortablePath(p: Path<unknown>): PortablePath;
function toPortablePath(p: Path<unknown>): PortablePath {
  if (process.platform !== `win32`)
    return p as PortablePath;

  if (p.match(WINDOWS_PATH_REGEXP))
    p = p.replace(WINDOWS_PATH_REGEXP, `/$1`);
  else if (p.match(UNC_WINDOWS_PATH_REGEXP))
    p = p.replace(UNC_WINDOWS_PATH_REGEXP, (match, p1, p2) => `/unc/${p1 ? `.dot/` : ``}${p2}`);

  return p.replace(/\\/g, `/`) as PortablePath;
}

export function convertPath<P extends Path>(targetPathUtils: PathUtils<P>, sourcePath: Path): P {
  return ((targetPathUtils as unknown === ppath) ? fromPortablePath(sourcePath) : toPortablePath(sourcePath)) as P;
}

export function toFilename(filename: string): Filename {
  if (npath.parse(filename as NativePath).dir !== `` || ppath.parse(filename as PortablePath).dir !== ``)
    throw new Error(`Invalid filename: "${filename}"`);

  return filename as any;
}
