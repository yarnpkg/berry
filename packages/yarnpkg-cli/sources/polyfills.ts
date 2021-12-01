const brotli = require(`brotli/decompress`);
const zlib = require(`zlib`);

zlib.brotliDecompressSync = (buffer: Buffer) => Buffer.from(brotli(buffer));

export {};
