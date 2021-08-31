// Test for https://github.com/yarnpkg/berry/issues/3058
// Fixed by https://github.com/merceyz/TypeScript/commit/98866a5a740b487c20046d4ffaa36aa1f202dde9

// The PnP patch returned the packageLocation with a trailing `/` which
// caused TypeScript to calculate the `subModuleName` incorrectly[1].
// This caused different files where only the first character of their
// basename was different to end up with the same packageIdKey[2].
// In this test the affected files were
// @types/lodash-es/find.d.ts -> @types/lodash-es/ind.d.ts@4.17.4
// @types/lodash-es/bind.d.ts -> @types/lodash-es/ind.d.ts@4.17.4
//
// 1: https://github.com/microsoft/TypeScript/blob/98866a5a740b487c20046d4ffaa36aa1f202dde9/src/compiler/moduleNameResolver.ts#L20
// 2: https://github.com/arcanis/TypeScript/blob/36225c32609137d29008e9d3ecf48c6f51456eb5/src/compiler/program.ts#L2625

import {find} from 'lodash-es';

find([``], () => true);

// This test is tested by typechecking the repository
