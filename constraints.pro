constraints_min_version(1).

% This file is written in Prolog
% It contains rules that the project must respect.
% In order to see them in action, run `berry constraints detail`

% This rule will prevent two of our workspaces from depending on different versions of a same dependency
gen_invalid_dependency(WorkspaceCwd, DependencyIdent, DependencyType, Reason) :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, _),
  workspace_has_dependency(OtherWorkspaceCwd, DependencyIdent, DependencyRange2, _),
  DependencyRange \= DependencyRange2,
  \+(gen_enforced_dependency_range(WorkspaceCwd, DependencyIdent, _, DependencyType)),
  atom_concat('this dependency range conflicts with the one used in ', OtherWorkspaceCwd, Reason).

% This rule will prevent workspaces from depending on non-workspace versions of available workspaces
gen_enforced_dependency_range(WorkspaceCwd, DependencyIdent, 'workspace:*', DependencyType) :-
  workspace_ident(_, DependencyIdent),
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType).

% The following rules describes which workspaces are allowed to depend on respectively "webpack" and "typescript"
workspace_allowed_dependency(WorkspaceCwd, 'webpack') :-
  workspace_ident(WorkspaceCwd, '@berry/builder').
workspace_allowed_dependency(WorkspaceCwd, 'typescript'):-
  workspace_ident(WorkspaceCwd, '@berry/builder').

% This rule will prevent workspaces from depending any blacklisted package
gen_enforced_dependency_range(WorkspaceCwd, DependencyIdent, null, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType),
  workspace_allowed_dependency(_, DependencyIdent),
  \+(workspace_allowed_dependency(WorkspaceCwd, DependencyIdent)).

% This rule will prevent all workspaces from depending on tslib
gen_enforced_dependency_range(WorkspaceCwd, 'tslib', null, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'tslib', _, DependencyType).
