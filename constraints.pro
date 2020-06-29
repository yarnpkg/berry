constraints_min_version(1).

% This file is written in Prolog
% It contains rules that the project must respect.
% In order to see them in action, run `yarn constraints detail`

% This rule will enforce that a workspace MUST depend on the same version of a dependency as the one used by the other workspaces
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, DependencyRange2, DependencyType) :-
  % Iterates over all dependencies from all workspaces
    workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  % Iterates over similarly-named dependencies from all workspaces (again)
    workspace_has_dependency(OtherWorkspaceCwd, DependencyIdent, DependencyRange2, DependencyType2),
  % Ignore peer dependencies
    DependencyType \= 'peerDependencies',
    DependencyType2 \= 'peerDependencies'.

% This rule will prevent workspaces from depending on non-workspace versions of available workspaces
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, WorkspaceRange, DependencyType) :-
  % Iterates over all dependencies from all workspaces
    workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  % Only consider those that target something that could be a workspace
    workspace_ident(DependencyCwd, DependencyIdent),
  % Obtain the version from the dependency
    workspace_field(DependencyCwd, 'version', DependencyVersion),
  % Quirk: we must discard the workspaces that don't declare a version
    atom(DependencyVersion),
  % Only proceed if the dependency isn't satisfied by a workspace
    \+ project_workspaces_by_descriptor(DependencyIdent, DependencyRange, DependencyCwd),
  % Derive the expected range from the version
    (
      DependencyType \= 'peerDependencies' ->
        atom_concat('workspace:^', DependencyVersion, WorkspaceRange)
      ;
        atom_concat('^', DependencyVersion, WorkspaceRange)
    ).

% This rule enforces that all packages that depend on TypeScript must also depend on tslib
gen_enforced_dependency(WorkspaceCwd, 'tslib', 'range', 'dependencies') :-
  % Iterates over all TypeScript dependencies from all workspaces
    workspace_has_dependency(WorkspaceCwd, 'typescript', _, DependencyType),
  % Ignores the case when TypeScript is a peer dependency
    DependencyType \= 'peerDependencies',
  % Only proceed if the workspace doesn't already depend on tslib
    \+ workspace_has_dependency(WorkspaceCwd, 'tslib', _, _).

% This rule will enforce that all packages must have a "BSD-2-Clause" license field
gen_enforced_field(WorkspaceCwd, 'license', 'BSD-2-Clause').

% This rule will enforce that all packages must have a engines.node field of >=10.19.0
gen_enforced_field(WorkspaceCwd, 'engines.node', '>=10.19.0').

% Required to make the package work with the GitHub Package Registry
gen_enforced_field(WorkspaceCwd, 'repository.type', 'git').
gen_enforced_field(WorkspaceCwd, 'repository.url', 'ssh://git@github.com/yarnpkg/berry.git').

% This rule will require that the plugins that aren't embed in the CLI list a specific script that'll
% be called as part of our release process (to rebuild them in the context of our repository)
gen_enforced_field(WorkspaceCwd, 'scripts.update-local', '<any value>') :-
  % Obtain the path for the CLI
    workspace_ident(CliCwd, '@yarnpkg/cli'),
  % Iterates over all workspaces whose name is prefixed with "@yarnpkg/plugin-"
    workspace_ident(WorkspaceCwd, WorkspaceIdent),
    atom_concat('@yarnpkg/plugin-', _, WorkspaceIdent),
  % Select those that are not included in the CLI bundle array
    \+ workspace_field_test(CliCwd, '@yarnpkg/builder.bundles.standard', '$$.includes($0)', [WorkspaceIdent]),
  % Only if they don't have a script set
    \+ workspace_field(WorkspaceCwd, 'scripts.update-local', _).

inline_compile('@yarnpkg/eslint-config').
inline_compile('@yarnpkg/libui').

gen_enforced_field(WorkspaceCwd, 'scripts.prepack', 'run build:compile "$(pwd)"') :-
  workspace(WorkspaceCwd),
  % This package is built using Webpack, so we allow it to configure its build scripts itself
    \+ workspace_ident(WorkspaceCwd, '@yarnpkg/pnp'),
  % Those packages use a different build
    \+ (workspace_ident(WorkspaceCwd, WorkspaceIdent), inline_compile(WorkspaceIdent)),
  % Private packages aren't covered
    \+ workspace_field_test(WorkspaceCwd, 'private', 'true').

gen_enforced_field(WorkspaceCwd, 'scripts.postpack', 'rm -rf lib') :-
  workspace(WorkspaceCwd),
  % This package is built using Webpack, so we allow it to configure its build scripts itself
    \+ workspace_ident(WorkspaceCwd, '@yarnpkg/pnp'),
  % Those packages use a different build
    \+ (workspace_ident(WorkspaceCwd, WorkspaceIdent), inline_compile(WorkspaceIdent)),
  % Private packages aren't covered
    \+ workspace_field_test(WorkspaceCwd, 'private', 'true').
