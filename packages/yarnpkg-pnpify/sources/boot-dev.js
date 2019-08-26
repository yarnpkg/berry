process.env.NODE_OPTIONS += ` --require ${require.resolve(`@yarnpkg/monorepo/scripts/setup-ts-execution`)}`;

require(`@yarnpkg/monorepo/scripts/setup-ts-execution`);

module.exports = require(`./index`);
