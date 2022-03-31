#!/usr/bin/env node

require(`../.pnp.cjs`).setup();
require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

const {tests: {startPackageServer}} = require(`../packages/acceptance-tests/pkg-tests-core`);

startPackageServer().then(registryUrl => {
  process.env.YARN_NPM_REGISTRY_SERVER = registryUrl;
  process.env.YARN_UNSAFE_HTTP_WHITELIST = new URL(registryUrl).hostname;

  require(`${__dirname}/../packages/yarnpkg-cli/sources/boot-cli-dev.js`);
});
