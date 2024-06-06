import cjs                  from '@rollup/plugin-commonjs';
import resolve              from '@rollup/plugin-node-resolve';
import path                 from 'path';
import esbuild              from 'rollup-plugin-esbuild';
import {defineConfig}       from 'rollup';
import semver               from 'semver';
import {brotliCompressSync} from 'zlib';

import pkg                  from './package.json';

/**
 * @returns {import('rollup').Plugin}
 */
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

/**
 * Before https://github.com/nodejs/node/pull/46904 using a custom global URL class
 * wasn't supported by `fileURLToPath` so this plugin ensures that for Node.js < 20
 * we always use the builtin URL class.
 * TODO: Remove this plugin when dropping support for Node.js < 20
 * @returns {import('rollup').Plugin}
 */
function importURL() {
  return {
    name: `import-url`,
    resolveId(id) {
      if (id === `virtual:url`) return `\0virtual:url`;

      return undefined;
    },
    load(id) {
      if (id === `\0virtual:url`) {
        return `
          import { URL as nodeURL } from 'url';
          export const URL = Number(process.versions.node.split('.', 1)[0]) < 20 ? nodeURL : globalThis.URL;
        `;
      }
      return undefined;
    },
    transform(code, id) {
      if (code.includes(`new URL`) || code.includes(`instanceof URL`))
        return `import {URL} from 'virtual:url';\n${code}`;

      return undefined;
    },
  };
}

// eslint-disable-next-line arca/no-default-export
export default defineConfig([
  {
    input: `./sources/loader/_entryPoint.ts`,
    output: {
      file: `./sources/hook.js`,
      format: `cjs`,
      exports: `default`,
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
        target: `node${semver.minVersion(pkg.engines.node).version}`,
        define: {
          document: `undefined`,
          XMLHttpRequest: `undefined`,
          crypto: `undefined`,
        },
      }),
      cjs({transformMixedEsModules: true, extensions: [`.js`, `.ts`]}),
      importURL(),
      wrapOutput(),
    ],
  },
  {
    input: `./sources/esm-loader/loader.ts`,
    output: {
      file: `./sources/esm-loader/built-loader.js`,
      format: `esm`,
      generatedCode: `es2015`,
      banner: `/* eslint-disable */\n// @ts-nocheck\n`,
    },
    external: [
      `../.pnp.cjs`,
    ],
    plugins: [
      resolve({
        extensions: [`.mjs`, `.js`, `.ts`, `.tsx`, `.json`],
        rootDir: path.join(__dirname, `../../`),
        jail: path.join(__dirname, `../../`),
        preferBuiltins: true,
      }),
      esbuild({
        tsconfig: false,
        target: `node${semver.minVersion(pkg.engines.node).version}`,
        define: {
          document: `undefined`,
          XMLHttpRequest: `undefined`,
          crypto: `undefined`,
        },
      }),
      cjs({requireReturnsDefault: `preferred`}),
      importURL(),
      wrapOutput(),
    ],
  },
  ...[`index`, `microkernel`].map(name =>
    defineConfig({
      input: `./sources/${name}.ts`,
      output: {
        file: `./lib/${name}.js`,
        format: `cjs`,
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
          target: `node${semver.minVersion(pkg.engines.node).version}`,
          define: {
            document: `undefined`,
            XMLHttpRequest: `undefined`,
            crypto: `undefined`,
          },
        }),
        cjs({transformMixedEsModules: true, extensions: [`.js`, `.ts`]}),
      ],
    }),
  ),
]);
