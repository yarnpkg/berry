const zlib = require(`zlib`);

if (!zlib.brotliDecompressSync)
  zlib.brotliDecompressSync = require(`brotli/decompress`);

export {};
