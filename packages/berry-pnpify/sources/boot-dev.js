process.env.NODE_OPTIONS += ` --require "${require.resolve(`ts-node/register/transpile-only`)}"`;
require(`ts-node/register/transpile-only`);

require(`./boot`);
