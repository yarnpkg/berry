import {FakeFS}              from './FakeFS';
import {NodeFS}              from './NodeFS';
import {ProxiedFS}           from './ProxiedFS';
import {ppath, PortablePath} from './path';

export type JailFSOptions = {
  baseFs?: FakeFS<PortablePath>,
  /**
   * The number of levels the Jail can be escaped.
   */
  levels?: number;
};

const JAIL_ROOT = PortablePath.root;
const LEVEL_REGEXP = /^\.\.\/?/;

/**
 * Computes the levels between 2 absolute paths.
 *
 * @param from An absolute PortablePath.
 * @param to An absolute PortablePath - an ancestor of `from`.
 */
export function computeLevels(from: PortablePath, to: PortablePath) {
  let relativePath = ppath.relative(from, to);

  let levels = 0;
  while (relativePath.match(LEVEL_REGEXP)) {
    relativePath = relativePath.replace(LEVEL_REGEXP, ``) as PortablePath;
    ++levels;
  }

  return levels;
}

export class JailFS extends ProxiedFS<PortablePath, PortablePath> {
  private readonly target: PortablePath;

  protected readonly baseFs: FakeFS<PortablePath>;

  protected readonly levels: number;

  constructor(target: PortablePath, {baseFs = new NodeFS(), levels = 0}: JailFSOptions = {}) {
    super(ppath);

    this.target = this.pathUtils.resolve(PortablePath.root, target);

    this.baseFs = baseFs;
    this.levels = levels;
  }

  getRealPath() {
    return this.pathUtils.resolve(this.baseFs.getRealPath(), this.pathUtils.relative(PortablePath.root, this.target));
  }

  getTarget() {
    return this.target;
  }

  getBaseFs() {
    return this.baseFs;
  }

  protected mapToBase(p: PortablePath): PortablePath {
    const normalized = this.pathUtils.normalize(p);

    if (this.pathUtils.isAbsolute(p))
      return this.pathUtils.resolve(this.target, this.pathUtils.relative(JAIL_ROOT, p));

    // If the Jail can be escaped a maximum of X levels, the pattern
    // should match X + 1 or more occurrences of '../' / '..'
    const levels = Math.abs(Math.floor(this.levels)) + 1;
    const pattern = Number.isFinite(levels)
      ? new RegExp(`^(\\.\\.\\/?){${levels},}`)
      : null;

    if (pattern !== null && normalized.match(pattern))
      throw new Error(`Resolving this path (${p}) would escape the jail with ${this.levels} levels`);

    return this.pathUtils.resolve(this.target, p);
  }

  protected mapFromBase(p: PortablePath): PortablePath {
    return this.pathUtils.resolve(JAIL_ROOT, this.pathUtils.relative(this.target, p));
  }
}
