const {
  fs: {writeFile},
} = require('pkg-tests-core');

const {environments} = require('./environments');

const queries = {
  [`single predicate`]: `dependency_type(DependencyType).`,
  [`single predicate with ignored variable`]: `workspace_ident(_, WorkspaceName).`,
  [`combined predicates`]: `dependency_type(DependencyType), workspace_has_dependency(_, DependencIdent, DependencyRange, DependencyType).`,
  [`custom predicate`]: `custom_predicate(DependencyType).`,
};

const constraintsFile = `
custom_predicate(DependencyType):-
  dependency_type(DependencyType),
  DependencyType \\= dependencies.
`;

describe(`Commands`, () => {
  describe(`constraints query`, () => {
    test(`test without trailing .`, makeTemporaryEnv({}, async({path, run, source}) => {
      await environments[`one regular dependency`](path);

      let code;
      let stdout;
      let stderr;

      try {
        ({code, stdout, stderr} = await run(`constraints`, `query`, `workspace_ident(_, WorkspaceName)`));
      } catch (error) {
        ({code, stdout, stderr} = error);
      }

      expect({code, stdout, stderr}).toMatchSnapshot();
    }));

    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [queryDescription, query] of Object.entries(queries)) {
        test(`test (${environmentDescription} / ${queryDescription})`, makeTemporaryEnv({}, async ({path, run, source}) => {
          await environment(path);
          await writeFile(`${path}/constraints.pro`, constraintsFile);

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`constraints`, `query`, query));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
