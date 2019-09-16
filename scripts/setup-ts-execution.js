const path = require(`path`);
const root = path.dirname(__dirname);

require(`@babel/register`)({
  only: [
    p => p.startsWith(require.resolve(`@yarnpkg/pnpify`)),
    // ...
  ],
});
