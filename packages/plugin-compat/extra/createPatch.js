const {readFileSync,writeFileSync} = require(`fs`);
const {brotliCompressSync} = require(`zlib`);

const patchContent = readFileSync(process.argv[2]);
const jsFile = process.argv[3];

writeFileSync(jsFile, `/* eslint-disable */
export const patch = require('zlib').brotliDecompressSync(Buffer.from('${
  brotliCompressSync(patchContent).toString(`base64`)
}', 'base64')).toString();
`);
