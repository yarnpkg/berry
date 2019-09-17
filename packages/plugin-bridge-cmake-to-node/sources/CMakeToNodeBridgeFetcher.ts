import {bridgeUtils}                        from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs} from '@yarnpkg/fslib';

export const CMakeToNodeBridgeFetcher = bridgeUtils.makeBridgeFetcher({
  hostLanguageName: `node`,
  guestLanguageName: `cmake`,
  generateBridge: async (location: PortablePath) => {
    await xfs.writeJsonPromise(ppath.join(location, `package.json` as Filename), {
      scripts: {
        install: `echo "module.exports=66" > index.js`,
      },
    });
  },
});
