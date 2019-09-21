#!/usr/bin/env node

const {existsSync} = require(`fs`);

if (process.env.DEV)
  require(`${__dirname}/../packages/yarnpkg-cli/sources/boot-cli-dev.js`);
else if (existsSync(`${__dirname}/../packages/yarnpkg-cli/bundles/yarn.js`))
  require(`${__dirname}/../packages/yarnpkg-cli/bundles/yarn.js`);
else
  require(`${__dirname}/../packages/yarnpkg-cli/bin/yarn.js`);
