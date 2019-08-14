process.env.NODE_OPTIONS += ` --require ${require.resolve(`@berry/monorepo/scripts/setup-ts-execution`)}`;

require(`@berry/monorepo/scripts/setup-ts-execution`);

require(`./cli`);
