const {
  fs: {writeFile},
} = require('pkg-tests-core');

declare var makeTemporaryEnv: any;

describe('Node_Modules', () => {
  it('should install one dependency',
    makeTemporaryEnv(
      {
        dependencies: {[`repeat-string`]: `1.6.1`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `nodeLinker: "node-modules"\n`);

        await expect(run(`install`)).resolves.toBe('abc');
      },
    ),
  );
});
