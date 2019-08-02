process.env.NODE_OPTIONS += ` --require ts-node/register/transpile-only`;
require(`ts-node/register/transpile-only`);

require(`./boot`);
