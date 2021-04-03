import cjs                  from "@rollup/plugin-commonjs";
import resolve              from "@rollup/plugin-node-resolve";
import path                 from "path";
import esbuild              from "rollup-plugin-esbuild";
import {brotliCompressSync} from "zlib";

function wrapOutput() {
  return {
    name: `wrap-output`,
    generateBundle(options, bundle, isWrite) {
      const bundles = Object.keys(bundle);
      if (bundles.length !== 1)
        throw new Error(`Expected only one bundle, got ${bundles.length}`);
      const outputBundle = bundle[bundles[0]];

      outputBundle.code = `let hook;\n\nmodule.exports = () => {\n  if (typeof hook === \`undefined\`)\n    hook = require('zlib').brotliDecompressSync(Buffer.from('${brotliCompressSync(
        outputBundle.code.replace(/\r\n/g, `\n`)
      ).toString(`base64`)}', 'base64')).toString();\n\n  return hook;\n};\n`;
    },
  };
}

// eslint-disable-next-line arca/no-default-export
export default [
  {
    input: `./sources/ZipConvertWorker.ts`,
    output: {
      file: `./sources/ZipConvertWorkerSource.js`,
      format: `cjs`,
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
      esbuild({tsconfig: false, target: `es2018`}),
      cjs({transformMixedEsModules: true, extensions: [`.js`, `.ts`]}),
      wrapOutput(),
    ],
  },
];
