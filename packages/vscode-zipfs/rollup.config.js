import cjs     from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import path    from 'path';
import esbuild from 'rollup-plugin-esbuild';

const mode = process.env.NODE_ENV || `production`;

// eslint-disable-next-line arca/no-default-export
export default async () => ({
  treeshake: {
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
    tryCatchDeoptimization: false,
  },
  input: `./sources/index.ts`,
  output: {
    file: `./build/index.js`,
    format: `cjs`,
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
    mode === `production` && (await import(`rollup-plugin-terser`)).terser({ecma: 2019}),
  ],
  external: [`vscode`],
});
