const {readFileSync,writeFileSync} = require(`fs`);
const {brotliCompressSync} = require(`zlib`);

const patchContent = readFileSync(process.argv[2]);
const patchEncoded = brotliCompressSync(patchContent).toString(`base64`);

const jsFile = process.argv[3];

writeFileSync(jsFile, `let patch: string;

export function getPatch() {
  if (typeof patch === \`undefined\`)
    patch = require(\`zlib\`).brotliDecompressSync(Buffer.from(\`${patchEncoded}\`, \`base64\`)).toString();

  return patch;
}
`);
