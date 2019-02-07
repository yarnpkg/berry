const {
  fs: {writeFile},
} = require('pkg-tests-core');

describe(`Basic tests`, () => {
  test(
    `it should change the configuration when found in the current directory`,
    makeTemporaryEnv(
      {},
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc`, `pnp-shebang "Hello World!"\n`);

        const config = JSON.parse((await run(`config`, `--json`)).stdout);

        expect(config).toMatchObject({
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
        await writeFile(`${path}/.foobarrc`, `pnp-shebang "Hello World!"\n`);

        const config = JSON.parse((await run(`config`, `--json`, {rcFilename: `.foobarrc`})).stdout);

        expect(config).toMatchObject({
          [`pnpShebang`]: {
            effective: `Hello World!`,
          },
        });
      },
    ),
  );
});
