import isWsl   from 'is-wsl';

import {tests} from 'pkg-tests-core';

const {startPackageServer, getPackageRegistry} = tests;

if (process.platform === `win32` || isWsl || process.platform === `darwin`)
  jest.setTimeout(10000);


beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
