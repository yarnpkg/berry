import {FakeFS}              from './FakeFS';
import {NodeFS}              from './NodeFS';
import {ProxiedFS}           from './ProxiedFS';
import {PortablePath, ppath} from './path';

export type CwdFSOptions = {
  baseFs?: FakeFS<PortablePath>,
};

export class CwdFS extends ProxiedFS<PortablePath, PortablePath> {
  private readonly target: PortablePath;

  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(target: PortablePath, {baseFs = new NodeFS()}: CwdFSOptions = {}) {
    super(ppath);

    if (!this.pathUtils.isAbsolute(target))
      throw new Error(`CwdFS target should be an absolute path`);

    this.target = this.pathUtils.normalize(target);

    this.baseFs = baseFs;
  }

  getRealPath() {
    return this.pathUtils.resolve(this.baseFs.getRealPath(), this.target);
  }

  mapFromBase(path: PortablePath) {
    return this.pathUtils.relative(this.target, path);
  }

  mapToBase(path: PortablePath) {
    return this.pathUtils.join(this.target, path);
  }
}
