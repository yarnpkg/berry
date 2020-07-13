import {FakeFS}                                           from './FakeFS';
import {ProxiedFS}                                        from './ProxiedFS';
import {npath, NativePath, PortablePath, ppath, PathLike} from './path';

export class PosixFS extends ProxiedFS<NativePath, PortablePath> {
  protected readonly baseFs: FakeFS<PortablePath>;

  constructor(baseFs: FakeFS<PortablePath>) {
    super(npath);

    this.baseFs = baseFs;
  }

  protected mapFromBase(path: PathLike<PortablePath>) {
    return npath.fromPortablePath(ppath.fromPathLike(path));
  }

  protected mapToBase(path: PathLike<NativePath>) {
    return npath.toPortablePath(npath.fromPathLike(path));
  }
}
