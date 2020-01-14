require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

const {tests: {startPackageServer}} = require(`pkg-tests-core`);

startPackageServer().then(url => {
  console.log(url);
});

setTimeout(() => {
  // Prevent exits
}, 2147483647);
