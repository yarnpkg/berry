const {
  fs: {readJson, readFile},
  tests: {getPackageDirectoryPath},
} = require('pkg-tests-core');
const {parseSyml} = require('@berry/parsers');

describe(`Protocols`, () => {
  describe(`git:`, () => {
    test(
      `it should resolve a dependency with git tag via git protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `git://github.com/TooTallNate/util-deprecate.git#v1.0.1`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@git://github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {
              "version": "1.0.1",
            },
          });

          await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
            name: `util-deprecate`,
            version: `1.0.1`,
          });
        },
      ),
    );

    test(
      `it should resolve a dependency with git tag via ssh protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@git+ssh://git@github.com/TooTallNate/util-deprecate.git#v1.0.1`]: {
              "version": "1.0.1",
            },
          });

          await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
            name: `util-deprecate`,
            version: `1.0.1`,
          });
        },
      ),
    );

    test(
      `it should resolve a dependency with git tag via https protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#v1.0.0`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#v1.0.0`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@https://github.com/TooTallNate/util-deprecate.git#v1.0.0`]: {
              "version": "1.0.0",
            },
          });

          await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
            name: `util-deprecate`,
            version: `1.0.0`,
          });
        },
      ),
    );

    test(
      `it should resolve a dependency with git branch via https protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#master`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#master`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@https://github.com/TooTallNate/util-deprecate.git#master`]: {
              "version": "1.0.2",
            },
          });

          await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
            name: `util-deprecate`,
            version: `1.0.2`,
          });
        },
      ),
    );

    test(
      `it should resolve a dependency with git commit via https protocol`,
      makeTemporaryEnv(
        {
          dependencies: {[`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#b3562c2`},
        },
        async ({path, run, source}) => {
          await run(`install`);

          await expect(readJson(`${path}/package.json`)).resolves.toMatchObject({
            dependencies: {
              [`util-deprecate`]: `https://github.com/TooTallNate/util-deprecate.git#b3562c2`,
            },
          });

          const content = await readFile(`${path}/yarn.lock`, `utf8`);
          const lock = parseSyml(content);

          await expect(lock).toMatchObject({
            [`util-deprecate@https://github.com/TooTallNate/util-deprecate.git#b3562c2`]: {
              "version": "1.0.0",
            },
          });

          await expect(source(`require('util-deprecate/package.json')`)).resolves.toMatchObject({
            name: `util-deprecate`,
            version: `1.0.0`,
          });
        },
      ),
    );
  });
});
