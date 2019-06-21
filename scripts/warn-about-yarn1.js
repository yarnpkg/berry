#!/usr/bin/env node

const {execSync} = require(`child_process`);

console.log(`Your global Yarn binary isn't recent enough; please upgrade to 1.17.2 or higher.`);
console.log(`Binary: ${execSync(`which yarn`).toString().trim()} (${execSync(`yarn --version`).toString().trim()})`);

process.exitCode = 1;
