import path from 'path';

enum PathType {
  File,
  Portable,
  Native,
}

export type PortablePath = string & { __pathType: PathType.File | PathType.Portable };
export type NativePath = string & { __pathType?: PathType.File | PathType.Native };

export const PortablePath = {
  root: `/` as PortablePath,
  dot: `.` as PortablePath,
  parent: `..` as PortablePath,
};

export type Filename = string & { __pathType: PathType.File };
export type Path = PortablePath | NativePath;

export const Filename = {
  home: `~` as Filename,
  nodeModules: `node_modules` as Filename,
  manifest: `package.json` as Filename,
  lockfile: `yarn.lock` as Filename,
  virtual: `__virtual__` as Filename,
  /**
   * @deprecated
   */
  pnpJs: `.pnp.js` as Filename,
  pnpCjs: `.pnp.cjs` as Filename,
  pnpData: `.pnp.data.json` as Filename,
  pnpEsmLoader: `.pnp.loader.mjs` as Filename,
  rc: `.yarnrc.yml` as Filename,
  env: `.env` as Filename,
};

export type TolerateLiterals<T> = {
  [K in keyof T]: ValidateLiteral<T[K]> | PortablePath | Filename;
};

export type ValidateLiteral<T> =
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  T extends `${infer X}`
    ? T
    : never;

export interface PortablePathGenerics {
  join<T extends Array<string>>(...segments: TolerateLiterals<T>): PortablePath;
  resolve<T extends string>(...pathSegments: Array<PortablePath | Filename | TolerateLiterals<T>>): PortablePath;
}

// Some of the FS functions support file descriptors
export type FSPath<T extends Path> = T | number;

export const npath: PathUtils<NativePath> & ConvertUtils = Object.create(path) as any;
export const ppath: PathUtils<PortablePath> & PortablePathGenerics = Object.create(path.posix) as any;

npath.cwd = () => process.cwd();
ppath.cwd = process.platform === `win32`
  ? () => toPortablePath(process.cwd())
  : process.cwd as () => PortablePath;

if (process.platform === `win32`) {
  ppath.resolve = (...segments: Array<PortablePath | Filename>) => {
    if (segments.length > 0 && ppath.isAbsolute(segments[0])) {
      return path.posix.resolve(...segments) as PortablePath;
    } else {
      return path.posix.resolve(ppath.cwd(), ...segments) as PortablePath;
    }
  };
}

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

type NoInfer<T> = [T][T extends any ? 0 : never];

export interface PathUtils<P extends Path> {
  cwd(): P;

  // We use NoInfer because otherwise TS will infer a wrong
  // type in ppath.contains, due to PortablePathGenerics
  join(...paths: Array<NoInfer<P> | Filename>): P;
  resolve(...pathSegments: Array<NoInfer<P> | Filename>): P;

  normalize(p: P): P;
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
}

export interface ConvertUtils {
  fromPortablePath: (p: Path) => NativePath;
  toPortablePath: (p: Path) => PortablePath;
}

const WINDOWS_PATH_REGEXP = /^([a-zA-Z]:.*)$/;
const UNC_WINDOWS_PATH_REGEXP = /^\/\/(\.\/)?(.*)$/;

const PORTABLE_PATH_REGEXP = /^\/([a-zA-Z]:.*)$/;
const UNC_PORTABLE_PATH_REGEXP = /^\/unc\/(\.dot\/)?(.*)$/;

// Path should look like "/N:/berry/scripts/plugin-pack.js"
// And transform to "N:\berry\scripts\plugin-pack.js"
function fromPortablePathWin32(p: Path): NativePath {
  let portablePathMatch, uncPortablePathMatch;
  if ((portablePathMatch = p.match(PORTABLE_PATH_REGEXP)))
    p = portablePathMatch[1];
  else if ((uncPortablePathMatch = p.match(UNC_PORTABLE_PATH_REGEXP)))
    p = `\\\\${uncPortablePathMatch[1] ? `.\\` : ``}${uncPortablePathMatch[2]}`;
  else
    return p as NativePath;

  return p.replace(/\//g, `\\`);
}

// Path should look like "N:/berry/scripts/plugin-pack.js"
// And transform to "/N:/berry/scripts/plugin-pack.js"
function toPortablePathWin32(p: Path): PortablePath {
  p = p.replace(/\\/g, `/`);

  let windowsPathMatch, uncWindowsPathMatch;
  if ((windowsPathMatch = p.match(WINDOWS_PATH_REGEXP)))
    p = `/${windowsPathMatch[1]}`;
  else if ((uncWindowsPathMatch = p.match(UNC_WINDOWS_PATH_REGEXP)))
    p = `/unc/${uncWindowsPathMatch[1] ? `.dot/` : ``}${uncWindowsPathMatch[2]}`;

  return p as PortablePath;
}

const toPortablePath = process.platform === `win32`
  ? toPortablePathWin32
  : (p: Path) => p as PortablePath;

const fromPortablePath = process.platform === `win32`
  ? fromPortablePathWin32
  : (p: Path) => p as NativePath;

npath.fromPortablePath = fromPortablePath;
npath.toPortablePath = toPortablePath;

export function convertPath<P extends Path>(targetPathUtils: PathUtils<P>, sourcePath: Path): P {
  return (targetPathUtils === (npath as PathUtils<NativePath>) ? fromPortablePath(sourcePath) : toPortablePath(sourcePath)) as P;
}
