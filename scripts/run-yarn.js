#!/usr/bin/env node

const {existsSync} = require(`fs`);

if (existsSync(`${__dirname}/../packages/yarnpkg-cli/bundles/yarn.js`))
  require(`${__dirname}/../packages/yarnpkg-cli/bundles/yarn.js`);
else
  require(`${__dirname}/../packages/yarnpkg-cli/bin/yarn.js`);
