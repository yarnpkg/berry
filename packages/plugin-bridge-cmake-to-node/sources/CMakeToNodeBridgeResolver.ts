import {bridgeUtils} from '@yarnpkg/core';

export const CMakeToNodeBridgeResolver = bridgeUtils.makeBridgeResolver({
  hostLanguageName: `node`,
  guestLanguageName: `cmake`,
});
