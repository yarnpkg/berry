import os      from 'os';
import {tests} from 'pkg-tests-core';

const {startPackageServer, getPackageRegistry} = tests;

jest.setTimeout(
  // Testing things inside a big-endian container takes forever
  os.endianness() === `BE`
    ? 100000
    : 30000,
);

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
