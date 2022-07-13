import 'jest-json';
import os      from 'os';
import {tests} from 'pkg-tests-core';

const {startPackageServer, getPackageRegistry} = tests;

jest.setTimeout(
  // Testing things inside a big-endian container takes forever
  os.endianness() === `BE`
    ? 150000
    : 45000,
);

beforeEach(async () => {
  await startPackageServer();
  await getPackageRegistry();
});
