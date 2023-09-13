import {ppath, xfs} from '@yarnpkg/fslib';

describe(`Features`, () => {
  describe(`Constraints Checks`, () => {
    test(
      `should detect constraints errors on install when enableConstraintsChecks is set to true`,
      makeTemporaryEnv({}, {
        enableConstraintsChecks: true,
      }, async ({path, run}) => {
        await xfs.writeFilePromise(ppath.join(path, `yarn.config.cjs`), [
          `exports.constraints = ({ Yarn }) => {\n`,
          `  for (const workspace of Yarn.workspaces()) {\n`,
          `    workspace.set('foo', 'bar')\n`,
          `  }\n`,
          `};\n`,
        ].join(``));

        await expect(run(`install`)).rejects.toThrow(/Constraint check failed; run yarn constraints for more details/);
      }),
    );
  });
});
