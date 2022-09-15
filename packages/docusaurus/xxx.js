require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

const {ppath, npath} = require(`@yarnpkg/fslib`);

const {mountMemoryDrive} = require(`./mountMemoryDrive`);

const memoryDrive = mountMemoryDrive(
  require(`fs`),
  ppath.join(npath.toPortablePath(__dirname), `docs/cli`),
);

memoryDrive.writeFileSync(`hello.md`, `This is a test!`);
