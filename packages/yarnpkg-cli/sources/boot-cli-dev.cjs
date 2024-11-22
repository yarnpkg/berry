const fs = require(`fs`);

// Makes it possible to access our dependencies
const pnpFile = `${__dirname}/../../../.pnp.cjs`;
if (fs.existsSync(pnpFile))
  require(pnpFile).setup();

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);
require(`@yarnpkg/monorepo/scripts/setup-local-plugins`);

require(`./cli`);
