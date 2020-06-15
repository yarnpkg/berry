const {
  fs: {writeFile},
} = require(`pkg-tests-core`);

const {environments} = require(`./environments`);

const queries = {
  [`single predicate`]: `dependency_type(DependencyType).`,
  [`single predicate with ignored variable`]: `workspace_ident(_, WorkspaceName).`,
  [`combined predicates`]: `dependency_type(DependencyType), workspace_has_dependency(_, DependencIdent, DependencyRange, DependencyType).`,
  [`custom predicate`]: `custom_predicate(DependencyType).`,
  [`filter w/ workspace_field_test/3`]: `workspace(WorkspaceCwd), workspace_field_test(WorkspaceCwd, 'name', '$$ === "workspace-a"').`,
  [`filter w/ workspace_field_test/4`]: `workspace(WorkspaceCwd), workspace_field_test(WorkspaceCwd, 'name', '$$ === $0', ['workspace-b']).`,
};

const constraintsFile = `
custom_predicate(DependencyType):-
  dependency_type(DependencyType),
  DependencyType \\= dependencies.
`;

describe(`Commands`, () => {
  describe(`constraints query`, () => {
    test(
      `test without trailing .`,
      makeTemporaryEnv({}, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
        ],
      }, async({path, run, source}) => {
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
      }),
    );

    test(
      `test with a syntax error`,
      makeTemporaryEnv({}, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
        ],
      }, async({path, run, source}) => {
        await environments[`one regular dependency`](path);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`constraints`, `query`, `*&%@$#$#!$@)`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `test with an unknown predicate`,
      makeTemporaryEnv({}, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
        ],
      }, async({path, run, source}) => {
        await environments[`one regular dependency`](path);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`constraints`, `query`, `hello_word(X)`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    test(
      `test with an empty predicate`,
      makeTemporaryEnv({}, {
        plugins: [
          require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
        ],
      }, async({path, run, source}) => {
        await environments[`one regular dependency`](path);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`constraints`, `query`, `workspace()`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      }),
    );

    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [queryDescription, query] of Object.entries(queries)) {
        test(
          `test (${environmentDescription} / ${queryDescription})`,
          makeTemporaryEnv({}, {
            plugins: [
              require.resolve(`@yarnpkg/monorepo/scripts/plugin-constraints.js`),
            ],
          }, async ({path, run, source}) => {
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
          }),
        );
      }
    }
  });
});
