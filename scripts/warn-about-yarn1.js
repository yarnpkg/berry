#!/usr/bin/env node

const {execSync} = require(`child_process`);

console.log(`Your global Yarn binary isn't recent enough; please upgrade to 1.17.2 or higher.`);

let info;
try {
  if (process.platform === `win32`) {
    info = `Binary: ${execSync(`where yarn`).toString().trim()} (${execSync(`yarn --version`).toString().trim()})`;
  } else {
    info = `Binary: ${execSync(`which yarn`).toString().trim()} (${execSync(`yarn --version`).toString().trim()})`;
  }
} catch (error) {
  info = null;
}

if (info !== null)
  console.log(info);

process.exitCode = 1;
