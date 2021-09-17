import cjs                  from '@rollup/plugin-commonjs';
import resolve              from '@rollup/plugin-node-resolve';
import path                 from 'path';
import esbuild              from 'rollup-plugin-esbuild';
import {brotliCompressSync} from 'zlib';

// eslint-disable-next-line arca/no-default-export
export default {
  input: `./sources/esm-loader/loader.ts`,
  output: {
    file: `./sources/esm-loader/built-loader.js`,
    format: `esm`,
  },
  plugins: [
    resolve({
      extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],
      rootDir: path.join(__dirname, `../../`),
      jail: path.join(__dirname, `../../`),
      preferBuiltins: true,
    }),
    esbuild({tsconfig: false, target: `node12`}),
    cjs({requireReturnsDefault: `preferred`}),
    {
      name: `wrap-output`,
      generateBundle(options, bundle, isWrite) {
        const bundles = Object.keys(bundle);
        if (bundles.length !== 1) throw new Error(`Expected only one bundle, got ${bundles.length}`);
        const outputBundle = bundle[bundles[0]];

        outputBundle.code = `let hook;\n\nmodule.exports = () => {\n  if (typeof hook === \`undefined\`)\n    hook = require('zlib').brotliDecompressSync(Buffer.from('${brotliCompressSync(
          outputBundle.code.replace(/\r\n/g, `\n`),
        ).toString(`base64`)}', 'base64')).toString();\n\n  return hook;\n};\n`;
      },
    },
  ],
};
