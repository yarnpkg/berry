#!/usr/bin/env node

const fs = require(`fs`);
const api = require.resolve(`pnpapi`);

require(`fs`).writeFileSync(api, fs.readFileSync(api));

setTimeout(() => {
  require.resolve(`pnpapi`);
}, 1000);
