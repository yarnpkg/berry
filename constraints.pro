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
    var(DependencyVersion),
  % Derive the expected range from the version
    atom_concat('workspace:', WorkspaceVersion, WorkspaceRange).

% This rule will prevent all workspaces from depending on tslib
gen_enforced_dependency(WorkspaceCwd, 'tslib', null, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'tslib', _, DependencyType).

% Required to make the package work with the GitHub Package Registry
gen_enforced_field(WorkspaceCwd, 'repository.type', 'git') :-
  workspace(WorkspacedCwd).
gen_enforced_field(WorkspaceCwd, 'repository.url', 'ssh://git@github.com/yarnpkg/berry.git') :-
  workspace(WorkspacedCwd).

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

gen_enforced_field(WorkspaceCwd, 'scripts.prepack', 'run build:compile "$(pwd)"') :-
  workspace(WorkspaceCwd),
  % This package is built using Webpack, so we allow it to configure its build scripts itself
    \+ workspace_ident(WorkspaceCwd, '@yarnpkg/pnp'),
  % Private packages aren't covered
    \+ workspace_field_test(WorkspaceCwd, 'private', 'true').

gen_enforced_field(WorkspaceCwd, 'scripts.postpack', 'rm -rf lib') :-
  workspace(WorkspaceCwd),
  % This package is built using Webpack, so we allow it to configure its build scripts itself
    \+ workspace_ident(WorkspaceCwd, '@yarnpkg/pnp'),
  % Private packages aren't covered
    \+ workspace_field_test(WorkspaceCwd, 'private', 'true').
