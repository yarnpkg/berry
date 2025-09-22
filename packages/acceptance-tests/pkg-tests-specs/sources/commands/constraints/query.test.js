const {
  fs: {writeFile},
  tests: {testIf},
} = require(`pkg-tests-core`);

const {environments} = require(`./environments`);

const queries = {
  [`single predicate`]: `dependency_type(DependencyType).`,
  [`single predicate with ignored variable`]: `workspace_ident(_, WorkspaceName).`,
  [`combined predicates`]: `dependency_type(DependencyType), workspace_has_dependency(_, DependencIdent, DependencyRange, DependencyType).`,
  [`custom predicate`]: `custom_predicate(DependencyType).`,
  [`filter w/ workspace_field_test/3`]: `workspace(WorkspaceCwd), workspace_field_test(WorkspaceCwd, 'name', '$$ === "workspace-a"').`,
  [`filter w/ workspace_field_test/4`]: `workspace(WorkspaceCwd), workspace_field_test(WorkspaceCwd, 'name', '$$ === $0', ['workspace-b']).`,
  [`workspace_field w/ string FieldValue`]: `workspace_field('.', 'name', FieldValue).`,
  [`workspace_field w/ object FieldValue`]: `workspace_field('.', 'repository', FieldValue).`,
  [`workspace_field w/ array FieldValue`]: `workspace_field('.', 'files', FieldValue).`,
};

const constraintsFile = `
custom_predicate(DependencyType):-
  dependency_type(DependencyType),
  DependencyType \\= dependencies.
`;

describe(`Commands`, () => {
  describe(`constraints query`, () => {
    testIf(
      `prologConstraints`,
      `test without trailing .`,
      makeTemporaryEnv({}, async({path, run, source}) => {
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

    testIf(
      `prologConstraints`,
      `test with a syntax error`,
      makeTemporaryEnv({}, async({path, run, source}) => {
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

    testIf(
      `prologConstraints`,
      `test with an unknown predicate`,
      makeTemporaryEnv({}, async({path, run, source}) => {
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

    testIf(
      `prologConstraints`,
      `test with an empty predicate`,
      makeTemporaryEnv({}, async({path, run, source}) => {
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
        testIf(
          `prologConstraints`,
          `test (${environmentDescription} / ${queryDescription})`,
          makeTemporaryEnv({}, async ({path, run, source}) => {
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
