const relPnpApiPath = "../../../.pnp.js";
const absPnpApiPath = require(`path`).resolve(__dirname, relPnpApiPath);

// Setup the environment to be able to require @berry/pnpify
require(absPnpApiPath).setup();

// Prepare the environment (to be ready in case of child_process.spawn etc)
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || ``;
process.env.NODE_OPTIONS += ` -r ${absPnpApiPath}`;
process.env.NODE_OPTIONS += ` -r ${require.resolve(`@berry/pnpify/lib`)}`;

// Apply PnPify to the current process
require(`@berry/pnpify/lib`).patchFs();

// Defer to the real typescript your application uses
require(`typescript/lib/tsserver`);
