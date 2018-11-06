constraints_min_version(1).

% This file is written in Prolog
% It contains rules that the project must respect.
% In order to see them in action, run `berry constraints detail`

% This rule will prevent two of our workspaces from depending on different versions of a same dependency
invalid_dependency(PackageIdent, PackageReference, DependencyIdent, DependencyRange, "This dependency conflicts with another one from another workspace") :-
  described_dependency(PackageIdent, PackageReference, DependencyIdent, DependencyRange),
  described_dependency(_, _, DependencyIdent, DependencyRange2),
  DependencyRange \= DependencyRange2.

singleton_dependency("webpack", "@berry/builder").
singleton_dependency("typescript", "@berry/builder").

% This rule will prevent workspaces from depending on non-workspace versions of available workspaces
enforced_dependency_range(PackageIdent, PackageReference, DependencyIdent, "workspace:0.0.0") :-
  is_workspace(DependencyIdent, _, _),
  described_dependency(PackageIdent, PackageReference, DependencyIdent, _).

% This rule will prevent workspaces from depending on the specified package (using `singleton_dependency` as store), except for one single workspace
enforced_dependency_range(PackageIdent, PackageReference, DependencyIdent, null) :-
  described_dependency(PackageIdent, PackageReference, DependencyIdent, _),
  singleton_dependency(DependencyIdent, _),
  \+(singleton_dependency(DependencyIdent, PackageIdent)).

% This rule will prevent all workspaces from depending on tslib
enforced_dependency_range(PackageIdent, PackageReference, "tslib", null) :-
  described_dependency(PackageIdent, PackageReference, "tslib", _).
