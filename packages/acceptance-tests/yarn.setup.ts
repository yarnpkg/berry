import {tests} from 'pkg-tests-core';

const {startPackageServer, getPackageRegistry} = tests;

jest.setTimeout(30000);

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
