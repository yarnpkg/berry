import {PortablePath, FakeFS, npath, PosixFS, extendFs} from '@yarnpkg/fslib';
import fastGlob                                         from 'fast-glob';
import fs                                               from 'fs';
import micromatch                                       from 'micromatch';

export type Glob = {
  isGlobPattern: (pattern: string) => boolean;
  match: (pattern: string, options: {cwd: PortablePath, baseFs: FakeFS<PortablePath>}) => Promise<Array<string>>;
};

export const micromatchOptions: micromatch.Options = {
  // This is required because we don't want ")/*" to be a valid shell glob pattern.
  strictBrackets: true,
};

export const fastGlobOptions: fastGlob.Options = {
  onlyDirectories: false,
  onlyFiles: false,
};

/**
 * Decides whether a string is a glob pattern, using micromatch.
 *
 * Required because `fastGlob.isDynamicPattern` doesn't have the `strictBrackets` option.
 */
export function isGlobPattern(pattern: string) {
  // The scanner extracts globs from a pattern, but doesn't throw errors
  if (!micromatch.scan(pattern, micromatchOptions).isGlob)
    return false;

  // The parser is the one that throws errors
  try {
    micromatch.parse(pattern, micromatchOptions);
  } catch {
    return false;
  }

  return true;
}

export function match(pattern: string, {cwd, baseFs}: {cwd: PortablePath, baseFs: FakeFS<PortablePath>}) {
  return fastGlob(pattern, {
    ...fastGlobOptions,
    cwd: npath.fromPortablePath(cwd),
    fs: extendFs(fs, new PosixFS(baseFs)),
  });
}

export function isBraceExpansion(pattern: string) {
  return micromatch.scan(pattern, micromatchOptions).isBrace;
}
