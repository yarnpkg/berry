const ts = require('typescript');
const tsNodeSwcCompiler = require('ts-node/dist/compilers/swc');
const typescriptCachedTranspile = require('typescript-cached-transpile/create');
const compiler = typescriptCachedTranspile.create({
  compiler: {
    ...ts,
    ...tsNodeSwcCompiler
  }
});
module.exports = compiler;
