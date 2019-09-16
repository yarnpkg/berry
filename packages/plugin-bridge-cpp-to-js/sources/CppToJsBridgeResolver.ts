import {bridgeUtils} from '@yarnpkg/core';

export const CppToJsBridgeResolver = bridgeUtils.makeBridgeResolver({
  hostLanguageName: `js`,
  guestLanguageName: `cpp`,
});
