import {GetMountPointFn, MountFS, MountFSOptions, NodeFS, patchFs, PortablePath, PosixFS} from '@yarnpkg/fslib';
import fs                                                                                 from 'fs';

import {ZipFS}                                                                            from './ZipFS';

export function mountMemoryDrive(origFs: typeof fs, mountPoint: PortablePath, source: Buffer = Buffer.alloc(0)) {
  const archive = new ZipFS(source);

  const getMountPoint: GetMountPointFn = (p: PortablePath) => {
    const detectedMountPoint = p.startsWith(`${mountPoint}/`) ? p.slice(0, mountPoint.length) as PortablePath : null;
    return detectedMountPoint;
  };

  const factoryPromise: MountFSOptions<ZipFS>[`factoryPromise`] = async (baseFs, p) => {
    return () => archive;
  };

  const factorySync: MountFSOptions<ZipFS>[`factorySync`] = (baseFs, p) => {
    return archive;
  };

  // We must copy the fs into a local, because otherwise
  // 1. we would make the NodeFS instance use the function that we patched (infinite loop)
  // 2. Object.create(fs) isn't enough, since it won't prevent the proto from being modified
  const localFs: typeof fs = {...origFs};
  const nodeFs = new NodeFS(localFs);

  const mountFs = new MountFS({
    baseFs: nodeFs,

    getMountPoint,

    factoryPromise,
    factorySync,

    magicByte: 21,
    maxAge: Infinity,
  });

  patchFs(fs, new PosixFS(mountFs));

  return archive;
}
