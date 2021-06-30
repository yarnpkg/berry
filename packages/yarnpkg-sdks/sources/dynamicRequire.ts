import {npath, PortablePath} from '@yarnpkg/fslib';

// This file is copied from miscUtils.ts - make sure your changes are synced there

export const dynamicRequire: NodeRequire = eval(`require`);

export function dynamicRequireNoCache(path: PortablePath) {
  const physicalPath = npath.fromPortablePath(path);

  const currentCacheEntry = dynamicRequire.cache[physicalPath];
  delete dynamicRequire.cache[physicalPath];

  let result;
  try {
    result = dynamicRequire(physicalPath);

    const freshCacheEntry = dynamicRequire.cache[physicalPath];

    const dynamicModule = eval(`module`) as NodeModule;
    const freshCacheIndex = dynamicModule.children.indexOf(freshCacheEntry);

    if (freshCacheIndex !== -1) {
      dynamicModule.children.splice(freshCacheIndex, 1);
    }
  } finally {
    dynamicRequire.cache[physicalPath] = currentCacheEntry;
  }

  return result;
}
