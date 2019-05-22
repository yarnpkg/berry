constraints_min_version(1).

% This file is written in Prolog
% It contains rules that the project must respect.
% In order to see them in action, run `berry constraints detail`

% This rule will prevent two of our workspaces from depending on different versions of a same dependency
gen_invalid_dependency(WorkspaceCwd, DependencyIdent, DependencyType, Reason) :-
  % Iterates over all dependencies from all workspaces
    workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, _),
  % Iterates over similarly-named dependencies from all workspaces (again)
    workspace_has_dependency(OtherWorkspaceCwd, DependencyIdent, DependencyRange2, _),
  % Only consider those that have a different range than us
    DependencyRange \= DependencyRange2,
  % Don't emit a gen_invalid_dependency rule if there's already a gen_enforced_dependency rule
    \+(gen_enforced_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType)),
  % Compute the reason
    atom_concat('this dependency range conflicts with the one used in ', OtherWorkspaceCwd, Reason).

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
    atom_concat('workspace:', WorkspaceVersion, WorkspaceRange),
  % True if the dependency doesn't match the expectation
    DependencyRange \= WorkspaceRange.

% This rule will prevent all workspaces from depending on tslib
gen_enforced_dependency(WorkspaceCwd, 'tslib', null, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'tslib', _, DependencyType).
