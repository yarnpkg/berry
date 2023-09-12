import {npath, ppath} from '@yarnpkg/fslib';

import {environments} from './constraints/environments';


const {
  fs: {writeFile},
} = require(`pkg-tests-core`);

const scriptNames = {
  prolog: `constraints.pro`,
  js: `yarn.config.cjs`,
};

const constraints = {
  [`empty constraints`]: {
    prolog: ``,
    js: ``,
  },
  [`gen_enforced_dependency (missing)`]: {
    prolog: `gen_enforced_dependency(WorkspaceCwd, 'one-fixed-dep', '1.0.0', peerDependencies).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set(['peerDependencies', 'one-fixed-dep'], '1.0.0'); };`,
  },
  [`gen_enforced_dependency (incompatible)`]: {
    prolog: `gen_enforced_dependency(WorkspaceCwd, 'no-deps', '2.0.0', dependencies).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set(['dependencies', 'no-deps'], '2.0.0'); };`,
  },
  [`gen_enforced_dependency (extraneous)`]: {
    prolog: `gen_enforced_dependency(WorkspaceCwd, 'no-deps', null, _).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set(['dependencies', 'no-deps'], undefined); };`,
  },
  [`gen_enforced_dependency (extraneous2)`]: {
    prolog: `
      gen_enforced_dependency(WorkspaceCwd, 'no-deps', null, _) :-
        WorkspaceCwd \\= '.'.
      gen_enforced_dependency(WorkspaceCwd, 'no-deps', '1.0.0', DependencyType) :-
        workspace_has_dependency(WorkspaceCwd, 'no-deps', '1.0.0', DependencyType).
    `,
    js: `
      exports.constraints = ({Yarn}) => {
        for (const d of Yarn.dependencies({ident: 'no-deps'})) d.delete();
        for (const d of Yarn.dependencies({ident: 'no-deps', range: '1.0.0'})) d.update('1.0.0');
      };
    `,
  },
  [`gen_enforced_dependency (ambiguous)`]: {
    prolog: `
      gen_enforced_dependency(WorkspaceCwd, 'no-deps', '1.0.0', dependencies).
      gen_enforced_dependency(WorkspaceCwd, 'no-deps', '2.0.0', dependencies).
    `,
    js: `
      exports.constraints = ({Yarn}) => {
        for (const w of Yarn.workspaces()) w.set(['dependencies', 'no-deps'], '1.0.0');
        for (const w of Yarn.workspaces()) w.set(['dependencies', 'no-deps'], '2.0.0');
      };
    `,
  },
  [`gen_enforced_field (missing)`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, 'dependencies["a-new-dep"]', '1.0.0').`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set(['dependencies', 'a-new-deps'], '1.0.0'); };`,
  },
  [`gen_enforced_field (incompatible)`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, 'dependencies["no-deps"]', '2.0.0').`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set(['dependencies', 'no-deps'], '2.0.0'); };`,
  },
  [`gen_enforced_field (extraneous)`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, 'dependencies', null).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.unset(['dependencies']); };`,
  },
  [`gen_enforced_field (ambiguous)`]: {
    prolog: `
      gen_enforced_field(WorkspaceCwd, 'dependencies["a-new-dep"]', '1.0.0').
      gen_enforced_field(WorkspaceCwd, 'dependencies["a-new-dep"]', '2.0.0').
    `,
    js: `
      exports.constraints = ({Yarn}) => {
        for (const w of Yarn.workspaces()) w.set(['dependencies', 'a-new-dep'], '1.0.0');
        for (const w of Yarn.workspaces()) w.set(['dependencies', 'a-new-dep'], '2.0.0');
      };
    `,
  },
  [`workspace_field w/ string FieldValue`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, '_name', FieldValue) :- workspace_field(WorkspaceCwd, 'name', FieldValue).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set('_name', w.manifest.name); };`,
  },
  [`workspace_field w/ object FieldValue`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, '_repository', FieldValue) :- workspace_field(WorkspaceCwd, 'repository', FieldValue).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set('_repository', w.manifest.repository); };`,
  },
  [`workspace_field w/ array FieldValue`]: {
    prolog: `gen_enforced_field(WorkspaceCwd, '_files', FieldValue) :- workspace_field(WorkspaceCwd, 'files', FieldValue).`,
    js: `exports.constraints = ({Yarn}) => { for (const w of Yarn.workspaces()) w.set('_files', w.manifest.files); };`,
  },
};

describe(`Commands`, () => {
  describe(`constraints`, () => {
    it(`should report custom errors`, makeTemporaryEnv({}, async ({path, run, source}) => {
      await run(`install`);

      await writeFile(ppath.join(path, `yarn.config.cjs`), `
        exports.constraints = ({Yarn}) => {
          Yarn.workspace().error('This should fail');
        };
      `);

      await expect(run(`constraints`)).rejects.toThrow(/This should fail/);
    }));

    for (const [environmentDescription, environment] of Object.entries(environments)) {
      for (const [scriptDescription, scripts] of Object.entries(constraints)) {
        for (const [scriptType, script] of Object.entries(scripts)) {
          test(`test (${environmentDescription} / ${scriptDescription} / ${scriptType})`,
            makeTemporaryEnv({}, async ({path, run, source}) => {
              await environment(path);
              await run(`install`);

              await writeFile(ppath.join(path, (scriptNames as any)[scriptType]), script);

              let code;
              let stdout;
              let stderr;

              try {
                ({code, stdout, stderr} = await run(`constraints`));
              } catch (error) {
                ({code, stdout, stderr} = error);
              }

              // TODO: Use .replaceAll when we drop support for Node.js v14
              stdout = stdout.split(npath.join(npath.fromPortablePath(path), `yarn.config.cjs`)).join(`/path/to/yarn.config.cjs`);
              stdout = stdout.replace(/(Module|Object)\.(exports\.)/g, `$2`);

              expect({code, stdout, stderr}).toMatchSnapshot();
            }),
          );
        }
      }
    }
  });
});
