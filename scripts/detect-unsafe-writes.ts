import {NodeFS, PortablePath, PosixFS, patchFs} from '@yarnpkg/fslib';
import fs                                       from 'fs';

class SafeCheckFS extends NodeFS {
  private lockRegistry = new Set<PortablePath>();

  async writeFilePromise(p: PortablePath, ...args: Array<any>) {
    return await this.lock(p, super.writeFilePromise, args);
  }

  private async lock(p: PortablePath, fn: (...args: Array<any>) => Promise<any>, args: Array<any>) {
    if (this.lockRegistry.has(p))
      throw new Error(`Unsafe write detected: ${p}`);

    this.lockRegistry.add(p);
    try {
      return await fn.call(this, p, ...args);
    } finally {
      this.lockRegistry.delete(p);
    }
  }
}

// We must copy the fs into a local, because otherwise
// 1. we would make the NodeFS instance use the function that we patched (infinite loop)
// 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
const localFs: typeof fs = {...fs};
const nodeFs = new SafeCheckFS(localFs);

patchFs(fs, new PosixFS(nodeFs));
