import {FakeFS}              from './FakeFS';
import {NodeFS}              from './NodeFS';
import {ProxiedFS}           from './ProxiedFS';
import {ppath, PortablePath} from './path';

export type SubFSOptions = {
  baseFs?: FakeFS<PortablePath>;
};

export class SubFS extends ProxiedFS<PortablePath, PortablePath> {
  private readonly target: PortablePath;

  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(target: PortablePath, {baseFs = new NodeFS()}: SubFSOptions = {}) {
    super(ppath);

    this.target = ppath.resolve(PortablePath.root, target);
    this.baseFs = baseFs;
  }

  getRealPath() {
    return ppath.resolve(this.baseFs.getRealPath(), ppath.relative(PortablePath.root, this.target));
  }

  protected mapToBase(p: PortablePath): PortablePath {
    return ppath.resolve(this.target, ppath.relative(PortablePath.root, ppath.resolve(PortablePath.root, p)));
  }

  protected mapFromBase(p: PortablePath): PortablePath {
    const relPath = ppath.relative(this.target, p);

    if (relPath.match(/^\.\.\/?/))
      throw new Error(`Path ${p} is outside of the jail`);

    return ppath.join(PortablePath.root, relPath);
  }
}
