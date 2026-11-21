import {FakeFS}              from './FakeFS';
import {NodeFS}              from './NodeFS';
import {ProxiedFS}           from './ProxiedFS';
import {ppath, PortablePath} from './path';

export type JailFSOptions = {
  baseFs?: FakeFS<PortablePath>;
};

export class JailFS extends ProxiedFS<PortablePath, PortablePath> {
  private readonly target: PortablePath;

  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(target: PortablePath, {baseFs = new NodeFS()}: JailFSOptions = {}) {
    super(ppath);

    this.target = this.pathUtils.resolve(PortablePath.root, target);
    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.target;
  }

  protected mapToBase(p: PortablePath): PortablePath {
    const normalized = ppath.resolve(this.target, p);

    if (!ppath.contains(this.target, normalized))
      throw new Error(`Resolving this path (${p}, resolved as ${normalized}) would escape the jail (${this.target})`);

    return normalized;
  }

  protected mapFromBase(p: PortablePath): PortablePath {
    return p;
  }
}
