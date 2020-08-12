import {xfs, Filename, ppath} from '@yarnpkg/fslib';

describe(`Plugins`, () => {
  describe(`cmake`, () => {
    test(
      `it should support building simple program without transitive dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`cmake-no-deps`]: `1.0.0`,
        },
      }, async ({path, run}) => {
        await xfs.writeFilePromise(ppath.join(path, Filename.rc), [
          `plugins:\n`,
          `  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-cmake.js`))}\n`,
        ].join(``));

        await xfs.writeFilePromise(ppath.join(path, `CMakeLists.txt` as Filename), [
          `cmake_minimum_required(VERSION 2.8)\n`,
          `project(myapp)\n`,
          `\n`,
          `include("$ENV{CMAKE_YARN_DEFINITION_FILE}")\n`,
          `find_yarn_dependencies()\n`,
          `\n`,
          `add_executable(app main.c)\n`,
          `target_link_libraries(app cmake-no-deps)\n`,
        ].join(``));

        await xfs.writeFilePromise(ppath.join(path, `main.c` as Filename), [
          `#include <cmake-no-deps.h>\n`,
          `int main() {\n`,
          `  return cmake_no_deps(2, 3);\n`,
          `}\n`,
        ].join(``));

        await run(`install`);

        const buildFolder = ppath.join(path, `build` as Filename);
        await xfs.mkdirPromise(buildFolder);

        await run(`exec`, `cmake`, `..`, {
          cwd: buildFolder,
        });

        await run(`exec`, `make`, {
          cwd: buildFolder,
        });
      }),
    );

    test(
      `it should support transitive dependencies`,
      makeTemporaryEnv({
        dependencies: {
          [`cmake-one-dep`]: `1.0.0`,
        },
      }, async ({path, run}) => {
        await xfs.writeFilePromise(ppath.join(path, Filename.rc), [
          `plugins:\n`,
          `  - ${JSON.stringify(require.resolve(`@yarnpkg/monorepo/scripts/plugin-cmake.js`))}\n`,
        ].join(``));

        await xfs.writeFilePromise(ppath.join(path, `CMakeLists.txt` as Filename), [
          `cmake_minimum_required(VERSION 2.8)\n`,
          `project(myapp)\n`,
          `\n`,
          `include("$ENV{CMAKE_YARN_DEFINITION_FILE}")\n`,
          `find_yarn_dependencies()\n`,
          `\n`,
          `add_executable(app main.c)\n`,
          `target_link_libraries(app cmake-one-dep)\n`,
        ].join(``));

        await xfs.writeFilePromise(ppath.join(path, `main.c` as Filename), [
          `#include <cmake-one-dep.h>\n`,
          `int main() {\n`,
          `  return cmake_one_dep(2, 3, 4, 5);\n`,
          `}\n`,
        ].join(``));

        await run(`install`);

        const buildFolder = ppath.join(path, `build` as Filename);
        await xfs.mkdirPromise(buildFolder);

        await run(`exec`, `cmake`, `..`, {
          cwd: buildFolder,
        });

        await run(`exec`, `make`, {
          cwd: buildFolder,
        });
      }),
    );
  });
});
