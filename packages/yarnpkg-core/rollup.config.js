import cjs                  from '@rollup/plugin-commonjs';
import resolve              from '@rollup/plugin-node-resolve';
import path                 from 'path';
import esbuild              from 'rollup-plugin-esbuild';
import {terser}             from 'rollup-plugin-terser';
import {defineConfig}       from 'rollup';
import {brotliCompressSync} from 'zlib';

function wrapOutput() {
  return {
    name: `wrap-output`,
    generateBundle(options, bundle, isWrite) {
      const bundles = Object.keys(bundle);
      if (bundles.length !== 1)
        throw new Error(`Expected only one bundle, got ${bundles.length}`);

      const outputBundle = bundle[bundles[0]];

      outputBundle.code = `let hook;\n\nmodule.exports.getContent = () => {\n  if (typeof hook === \`undefined\`)\n    hook = require('zlib').brotliDecompressSync(Buffer.from('${brotliCompressSync(
        outputBundle.code.replace(/\r\n/g, `\n`),
      ).toString(`base64`)}', 'base64')).toString();\n\n  return hook;\n};\n`;
    },
  };
}

// eslint-disable-next-line arca/no-default-export
export default defineConfig({
  input: `./sources/worker-zip/Worker.ts`,
  output: {
    file: `./sources/worker-zip/index.js`,
    format: `cjs`,
    strict: false,
    generatedCode: `es2015`,
  },
  plugins: [
    resolve({
      extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],
      rootDir: path.join(__dirname, `../../`),
      jail: path.join(__dirname, `../../`),
      preferBuiltins: true,
    }),
    esbuild({
      tsconfig: false,
      target: `node12`,
      define: {
        document: `undefined`,
        XMLHttpRequest: `undefined`,
        crypto: `undefined`,
      },
    }),
    cjs({transformMixedEsModules: true, extensions: [`.js`, `.ts`]}),
    terser({ecma: 2019}),
    wrapOutput(),
  ],
});
