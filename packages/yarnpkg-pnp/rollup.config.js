import cjs                  from '@rollup/plugin-commonjs';
import resolve              from '@rollup/plugin-node-resolve';
import path                 from 'path';
import esbuild              from 'rollup-plugin-esbuild';
import {brotliCompressSync} from 'zlib';

function wrapOutput() {
  return {
    name: `wrap-output`,
    generateBundle(options, bundle, isWrite) {
      const bundles = Object.keys(bundle);
      if (bundles.length !== 1)
        throw new Error(`Expected only one bundle, got ${bundles.length}`);

      const outputBundle = bundle[bundles[0]];

      outputBundle.code = `let hook;\n\nmodule.exports = () => {\n  if (typeof hook === \`undefined\`)\n    hook = require('zlib').brotliDecompressSync(Buffer.from('${brotliCompressSync(
        outputBundle.code.replace(/\r\n/g, `\n`),
      ).toString(`base64`)}', 'base64')).toString();\n\n  return hook;\n};\n`;
    },
  };
}

/** @type {Array<import('rollup').RollupOptions>} */
const options = [
  {
    input: `./sources/loader/_entryPoint.ts`,
    output: {
      file: `./sources/hook.js`,
      format: `cjs`,
      exports: `default`,
      strict: false,
      preferConst: true,
    },
    plugins: [
      resolve({
        extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],
        rootDir: path.join(__dirname, `../../`),
        jail: path.join(__dirname, `../../`),
        preferBuiltins: true,
      }),
      esbuild({tsconfig: false, target: `node12`}),
      cjs({transformMixedEsModules: true, extensions: [`.js`, `.ts`]}),
      wrapOutput(),
    ],
  },
  {
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
      wrapOutput(),
    ],
  },
];

// eslint-disable-next-line arca/no-default-export
export default options;
