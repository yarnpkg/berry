import fs             from 'fs';

import {MountFS}      from '../MountFS';
import {applyFsLayer} from '../patchFs/patchFs';
import {PortablePath} from '../path';

export function mountFolder(origFs: typeof fs, mountPoint: PortablePath, targetPath: PortablePath) {
  applyFsLayer(origFs, baseFs => {
    return MountFS.createFolderMount({
      baseFs,
      mountPoint,
      targetPath,
    });
  });
}
