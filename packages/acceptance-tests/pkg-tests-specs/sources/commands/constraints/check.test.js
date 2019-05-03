const {
  fs: {writeFile},
} = require('pkg-tests-core');

const {environments} = require('./environments');

const constraints = {
  [`empty constraints`]: ``,
  [`gen_enforced_dependency_range (missing)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'one-fixed-dep', '1.0.0', peerDependencies).`,
  [`gen_enforced_dependency_range (incompatible)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'no-deps', '2.0.0', dependencies).`,
  [`gen_enforced_dependency_range (extraneous)`]: `gen_enforced_dependency_range(WorkspaceCwd, 'no-deps', null, _).`,
  [`gen_invalid_dependency (deep field path)`]: `gen_invalid_dependency(WorkspaceCwd, 'no-deps', DependencyType, 'no-deps is not allowed unless built is set to false') :-
      workspace_has_dependency(WorkspaceCwd, 'no-deps', _, DependencyType),
      \\+(workspace_field(WorkspaceCwd, 'dependenciesMeta.no-deps.built', false)).`,
  [`gen_workspace_field_requirement (missing)`]: `gen_workspace_field_requirement(WorkspaceCwd, 'dependencies["a-new-dep"]', '1.0.0').`,
  [`gen_workspace_field_requirement (incompatible)`]: `gen_workspace_field_requirement(WorkspaceCwd, 'dependencies["no-deps"]', '2.0.0').`,
  [`gen_workspace_field_requirement (extraneous)`]: `gen_workspace_field_requirement(WorkspaceCwd, 'dependencies', null).`,
};

describe(`Commands`, () => {
  describe(`constraints check`, () => {
    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [scriptDescription, script] of Object.entries(constraints)) {
        test(`test (${environmentDescription} / ${scriptDescription})`, makeTemporaryEnv({}, async ({path, run, source}) => {
          await environment(path);
          await writeFile(`${path}/constraints.pro`, script);

          let code;
          let stdout;
          let stderr;

          try {
            ({code, stdout, stderr} = await run(`constraints`, `check`));
          } catch (error) {
            ({code, stdout, stderr} = error);
          }

          expect({code, stdout, stderr}).toMatchSnapshot();
        }));
      }
    }
  });
});
