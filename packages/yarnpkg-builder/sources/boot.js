#!/usr/bin/env node

require(`@yarnpkg/pnpify`).patchFs();

require(`./cli`);
