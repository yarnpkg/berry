---
id: workspaces-constraints
title: Workspaces Constraints
sidebar_label: Workspaces Constraints
---

Constraints answer to a very basic need: I have a lot of different workspaces,
and I need to make sure they use similar dependencies. Or that they don't
depend on a specific package. Or that they use a specific type of dependency.
Whatever is the exact logic, my goal is the same: I want to automatically
enforce some kind of rule accross all my workspaces. That's exactly what
constraints allow you to do.

## Creating a constraint

Constraints are created by adding a `constraints.pro` file at the root of your
project (repository). The `.pro` extension might leave you perplex: this is
because constraints aren't written in JavaScript (what?) but rather in Prolog,
a fact-based rule engine. The goal of this section isn't to teach you Prolog
(good tutorials already exist, such as [Learn Prolog in Y Minutes](https://learnxinyminutes.com/docs/prolog/)),
but rather to show you why we chose it and the value it brings.

As we mentioned, Prolog is a fact-based engine. It starts with a list of
*facts* that are always true, and a list of *predicates* that basically read as
"predicate `f(X)` is true if `u(X)` and `v(X)` are both true". By computing for
which values of `X` are `u(X)` and `v(X)` true, Prolog is able to automatically
compute the list of values for which `f(X)` would be true.

Going back to the constraints the *facts* are definitions created by the
package manager, and the *predicates* are the set of actions that you want to
perform. In order to do this, the constraint engine exposes the following
functions:

### Query predicate

The following predicates are meant to be used in the dependencies of your own
rules (check the recipes for examples how to use them in practice). Note that
the `/<number>` syntax listed at the end simply is the predicate arity (number
of arguments it takes).

#### `is_workspace/3`

```prolog
is_workspace(
  WorkspaceIdent,
  WorkspaceReference,
  WorkspaceCwd
).
```

True if the workspace described by the specified `WorkspaceIdent` exists at
location `WorkspaceCwd` AND it has the specified `WorkspaceReference`.

#### `described_dependency/4`

```prolog
described_dependency(
  WorkspaceIdent,
  WorkspaceReference,
  DependencyIdent,
  DependencyRange
).
```

True if the workspace described by the specified `WorkspaceIdent` and
`WorkspaceReference` combination depends on the dependency described by the
specified `DependencyIdent` and `DependencyRange` combination.

### Constraint predicates

#### `enforced_dependency_range/4`

```prolog
enforced_dependency_range(
  WorkspaceIdent,
  WorkspaceReference,
  DependencyIdent,
  DependencyRange
).
```

The `enforced_dependency_range` rule offers a neat way to inform the package
manager that a specific workspace MUST either depend on a specific range of
a specific dependency (if `DependencyRange` is non-null) or not depend at all
on the dependency (if `DependencyRange` is null).

  - This predicate allows the package manager to autofix the problems

#### `invalid_dependency/5`

```prolog
invalid_dependency(
  WorkspaceIdent,
  WorkspaceReference,
  DependencyIdent,
  DependencyRange,
  Reason
).
```

The `invalid_dependency` predicate is used to inform the package manager that a
particular dependency isn't allowed. Contrary to `enforced_dependency_range`,
`invalid_dependency` doesn't allow the package manager to autofix the problem
(instead, it has an extra parameter that's used to inform the human operator of
the reason why the dependency isn't allowed).

- The errors reported by this predicate can be auto-fixed
- The reason parameter can be any string of your liking

## Constraint recipes

The following constraints are a good starting point to figure out how to write
your owns. If you build others that would be a good fit for this section, open
a PR and we'll add them here!

**Prevent all workspaces from depending on a specific package**

```prolog
enforced_dependency_range(PackageIdent, PackageReference, "tslib", null) :-
  described_dependency(PackageIdent, PackageReference, "tslib", _).
```

We define a rule that says that for each dependency of each workspace in our
project, if this dependency name is `tslib`, then it exists a similar rule
of the `enforced_dependency_range` type that forbids the workspace from
depending on `tslib`. This will cause the package manager to see that the
rule isn't met, and autofix it when requested by removing the dependency from
the workspace.

**Prevent two workspaces from depending on conflicting version of a dependency**

```prolog
invalid_dependency(PackageIdent, PackageReference, DependencyIdent, DependencyRange, "This dependency conflicts with another one from another workspace") :-
  described_dependency(PackageIdent, PackageReference, DependencyIdent, DependencyRange),
  described_dependency(_, _, DependencyIdent, DependencyRange2),
  DependencyRange \= DependencyRange2.
```

We define a `invalid_dependency` rule that is true for each dependency of each
package (first `described_dependency`) if it also exists another dependency of
another package (second `described_dependency`) that has the same name but a
different range (`\=` operator).

**Force all workspace dependencies to be made explicit**

```prolog
enforced_dependency_range(PackageIdent, PackageReference, DependencyIdent, "workspace:0.0.0") :-
  is_workspace(DependencyIdent, _, _),
  described_dependency(PackageIdent, PackageReference, DependencyIdent, _).
```

We define a `enforced_dependency_range` that requires the dependency range
"workspace:0.0.0" to be used if the dependency name is also the name of a
valid workspace. The final `described_dependency` check is there to ensure
that this rule is only applied on workspace that currently depend on the
specified workspace in the first place (if it wasn't there, the rule would
instead force all workspaces to depend on one another).
