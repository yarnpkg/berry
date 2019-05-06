const {
  fs: {writeFile},
} = require('pkg-tests-core');

const {environments} = require('./environments');

const constraints = {
  [`empty constraints`]: ``,
  [`gen_enforced_dependency (missing)`]: `gen_enforced_dependency(WorkspaceCwd, 'one-fixed-dep', '1.0.0', peerDependencies).`,
  [`gen_enforced_dependency (incompatible)`]: `gen_enforced_dependency(WorkspaceCwd, 'no-deps', '2.0.0', dependencies).`,
  [`gen_enforced_dependency (extraneous)`]: `gen_enforced_dependency(WorkspaceCwd, 'no-deps', null, _).`,
  [`gen_invalid_dependency (deep field path)`]: `gen_invalid_dependency(WorkspaceCwd, 'no-deps', DependencyType, 'no-deps is not allowed unless built is set to false') :-
      workspace_has_dependency(WorkspaceCwd, 'no-deps', _, DependencyType),
      \\+(workspace_field(WorkspaceCwd, 'dependenciesMeta.no-deps.built', false)).`,
  [`gen_enforced_field (missing)`]: `gen_enforced_field(WorkspaceCwd, 'dependencies["a-new-dep"]', '1.0.0').`,
  [`gen_enforced_field (incompatible)`]: `gen_enforced_field(WorkspaceCwd, 'dependencies["no-deps"]', '2.0.0').`,
  [`gen_enforced_field (extraneous)`]: `gen_enforced_field(WorkspaceCwd, 'dependencies', null).`,
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
