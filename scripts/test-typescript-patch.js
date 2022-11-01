const {createRequire} = require(`module`);
const path = require(`path`);
const ts = require(`typescript`);

const tsconfigFile = ts.readJsonConfigFile(
  require.resolve(`@yarnpkg/monorepo/package.json`),
  ts.sys.readFile,
);

const compilerOptions = ts.parseJsonSourceFileConfigFileContent(
  tsconfigFile,
  ts.sys,
  path.dirname(tsconfigFile.fileName),
);

const compilerHost = ts.createCompilerHost(compilerOptions);
const program = ts.createProgram(compilerOptions.fileNames, compilerOptions, compilerHost);
const moduleSpecifierResolutionHost = ts.createModuleSpecifierResolutionHost(program, compilerHost);

const yarnCorePkgDir = require.resolve(`@yarnpkg/core/package.json`).replace(`/package.json`, ``);
const fslibPkgDir = require.resolve(`@yarnpkg/fslib/package.json`).replace(`/package.json`, ``);
const libzipPkgDir = require.resolve(`@yarnpkg/libzip/package.json`).replace(`/package.json`, ``);
const rootSourceFile = program.getSourceFile(require.resolve(`${yarnCorePkgDir}/sources/Project.ts`));

const TESTS = [
  [`${yarnCorePkgDir}/sources/Configuration.ts`, `./Configuration`],
  [`${fslibPkgDir}/README.md`, `@yarnpkg/fslib/README.md`],
  [`${fslibPkgDir}/package.json`, `@yarnpkg/fslib/package.json`],
  [`${libzipPkgDir}/sources/ZipFS.ts`, `@yarnpkg/libzip/sources/ZipFS`],
  [`${fslibPkgDir}/sources/index.ts`, `@yarnpkg/fslib`],
];

for (const [test, expected] of TESTS) {
  const actual = ts.moduleSpecifiers.getModuleSpecifier(
    compilerOptions,
    rootSourceFile,
    rootSourceFile.fileName,
    createRequire(rootSourceFile.fileName).resolve(test),
    moduleSpecifierResolutionHost,
  );

  if (actual === expected) {
    console.log(`\x1b[32m✓\x1b[0m ${actual}`);
  } else {
    console.log(`\x1b[31m✗\x1b[0m ${actual} !== ${expected}`);
    process.exitCode = 1;
  }
}
