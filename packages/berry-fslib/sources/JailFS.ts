import {FakeFS}            from './FakeFS';
import {NodeFS}                                            from './NodeFS';
import { portablePathUtils, PortablePath } from './path';
import { ProxiedFS } from './ProxiedFS';

export type JailFSOptions = {
  baseFs?: FakeFS<PortablePath>,
};

const JAIL_ROOT = `/` as PortablePath;

export class JailFS extends ProxiedFS<PortablePath, PortablePath> {
  private readonly target: PortablePath;

  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(target: PortablePath, {baseFs = new NodeFS()}: JailFSOptions = {}) {
    super(portablePathUtils);

    this.target = this.pathUtils.resolve(`/` as PortablePath, target);

    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.pathUtils.resolve(this.baseFs.getRealPath(), this.pathUtils.relative(`/` as PortablePath, this.target));
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

    if (normalized.match(/^\.\.\//))
      throw new Error(`Resolving this path (${p}) would escape the jail`);

    return this.pathUtils.resolve(this.target, p);
  }

  protected mapFromBase(p: PortablePath): PortablePath {
    return this.pathUtils.resolve(JAIL_ROOT, this.pathUtils.relative(this.target, p));
  }
}
