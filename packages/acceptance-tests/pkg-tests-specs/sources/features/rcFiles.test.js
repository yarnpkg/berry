const {
  fs: {writeFile},
  misc: {parseJsonStream},
} = require(`pkg-tests-core`);

describe(`Features`, () => {
  describe(`Rc files`, () => {
    test(
      `it should change the configuration when found in the current directory`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await writeFile(`${path}/.yarnrc.yml`, `pnpShebang: "Hello World!"\n`);

          expect(parseJsonStream(
            (await run(`config`, `--json`)).stdout,
            `key`,
          )).toMatchObject({
            [`pnpShebang`]: {
              effective: `Hello World!`,
            },
          });
        },
      ),
    );

    test(
      `it should support changing the rc filename via the environment`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await writeFile(`${path}/.foobarrc`, `pnpShebang: "Hello World!"\n`);

          expect(parseJsonStream(
            (await run(`config`, `--json`, {rcFilename: `.foobarrc`})).stdout,
            `key`,
          )).toMatchObject({
            [`pnpShebang`]: {
              effective: `Hello World!`,
            },
          });
        },
      ),
    );
  });
});
