import {bridgeUtils} from '@yarnpkg/core';

export const CppToJsBridgeFetcher = bridgeUtils.makeBridgeFetcher({
  hostLanguageName: `js`,
  guestLanguageName: `cpp`,

});
