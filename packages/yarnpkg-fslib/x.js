const {ZipFS} = require(`@yarnpkg/fslib`);
const {getLibzipSync} = require(`@yarnpkg/libzip`);

const zipFs = new ZipFS(`${__dirname}/../../.yarn/cache/typescript-npm-3.7.4-29c6a83598-2.zip`, {
  libzip: getLibzipSync(),
});

const stat = zipFs.lstatSync(`/node_modules`);

console.log(stat.mtime.getUTCHours());
console.log(stat.mtime.getHours());
console.log(stat);
