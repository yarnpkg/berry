#!/usr/bin/env node

const {existsSync} = require(`fs`);
const {createRequire, register} = require(`module`);
const {resolve} = require(`path`);
const {pathToFileURL} = require(`url`);

const relPnpApiPath = "../../../../.pnp.cjs";

const absPnpApiPath = resolve(__dirname, relPnpApiPath);
const absRequire = createRequire(absPnpApiPath);

const absPnpLoaderPath = resolve(absPnpApiPath, `../.pnp.loader.mjs`);
const isPnpLoaderEnabled = existsSync(absPnpLoaderPath);

if (existsSync(absPnpApiPath)) {
  if (!process.versions.pnp) {
    // Setup the environment to be able to require typescript
    require(absPnpApiPath).setup();
    if (isPnpLoaderEnabled && register) {
      register(pathToFileURL(absPnpLoaderPath));
    }
  }
}

// Defer to the real typescript your application uses
module.exports = absRequire(`typescript`);
