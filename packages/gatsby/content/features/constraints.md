---
category: features
path: /features/constraints
title: "Constraints"
---

> **Experimental**
>
> This feature is still incubating, and its exact API might change from a release to the next. It means it's the perfect time for you to get involved and let us hear your feedback!

Constraints are a solution to a very basic need: I have a lot of [workspaces](/features/workspaces), and I need to make sure they use the same version of their dependencies. Or that they don't depend on a specific package. Or that they use a specific type of dependency. Anyway, you see the point: whatever is the exact logic, my goal is the same; I want to automatically enforce some kind of rule accross all my workspaces. That's exactly what constraints allow you to do.

## Creating a constraint

Constraints are created by adding a `constraints.pro` file at the root of your project (repository). The `.pro` extension might leave you perplex: this is because constraints aren't written in JavaScript (!) but rather in Prolog, a fact-based rule engine. The goal of this section isn't to teach you Prolog (good tutorials already exist, such as [Learn Prolog in Y Minutes](https://learnxinyminutes.com/docs/prolog/)),
but rather to show you why we chose it and the value it brings.

As we mentioned, Prolog is a fact-based engine. It starts with a list of *facts* that are always true, and a list of *predicates* that basically read as "predicate `f(X)` is true if `u(X)` and `v(X)` are both true". By computing for which values of `X` are `u(X)` and `v(X)` true, Prolog is able to automatically compute the list of values for which `f(X)` would be true. This is particularly useful for contraints, because it allows you to write very simple but powerful rules that have the ability to affect all your workspaces in very few lines.

Going back to the constraint engine, the *facts* are the definitions created by the package manager (such as "fact: the root workspace depends on Lodash version 4.4.2 in devDependencies"), and the *predicates* are the set of rules that you want to enforce accross your project (check below for some recipes).

### Query predicate

The following predicates provide information about the current state of your project and are meant to be used in the dependencies of your own rules (check the recipes for examples how to use them in practice). Note that the `/<number>` syntax listed at the end simply is the predicate arity (number of arguments it takes).

#### `dependency_type/1`

```prolog
dependency_type(
  DependencyType
).
```

True for only three values: `dependencies`, `devDependencies` and `peerDependencies`.

#### `workspace/1`

```prolog
workspace(
  WorkspaceCwd
).
```

True if the workspace described by the specified `WorkspaceCwd` exists.

#### `workspace_ident/2`

```prolog
workspace_ident(
  WorkspaceCwd,
  WorkspaceIdent
).
```

True if the workspace described by the specified `WorkspaceCwd` exists and if it has the specified `WorkspaceIdent`.

#### `workspace_version/2`

```prolog
workspace_version(
  WorkspaceCwd,
  WorkspaceVersion
).
```

True if the workspace described by the specified `WorkspacedCwd` exists and if it has the specified `WorkspaceVersion`.

#### `workspace_has_dependency/4`

```prolog
workspace_has_dependency(
  WorkspaceCwd,
  DependencyIdent,
  DependencyRange,
  DependencyType
).
```

True if the workspace described by the specified `WorkspaceCwd` depends on the dependency described by the specified `DependencyIdent` and `DependencyRange` combination in the dependencies block of the given `DependencyType`.

### Constraint predicates

The following predicates will affect the behavior of the `yarn constraints check` and `yarn constraints fix` commands.

#### `gen_enforced_dependency_range/4`

```prolog
gen_enforced_dependency_range(
  WorkspaceCwd,
  DependencyIdent,
  DependencyRange,
  DependencyType
).
```

The `gen_enforced_dependency_range` rule offers a neat way to inform the package manager that a specific workspace MUST either depend on a specific range of a specific dependency (if `DependencyRange` is non-null) or not depend at all on the dependency (if `DependencyRange` is null) in the `DependencyType` dependencies block.

- **This predicate allows the package manager to autofix the problems.**

#### `gen_invalid_dependency/4`

```prolog
gen_invalid_dependency(
  WorkspaceCwd,
  DependencyIdent,
  DependencyType,
  Reason
).
```

The `gen_invalid_dependency` predicate is used to inform the package manager that a specific workspace cannot depend on its current version of the package defined by `DependencyIdent` in the `DependencyType` dependencies, the `Reason` parameter being offered as a way to express why the dependency is invalid.

Contrary to `gen_enforced_dependency_range`, `gen_invalid_dependency` doesn't allow the package manager to autofix the problem. This makes `gen_invalid_dependency` suitable in case where the right fix would be ambiguous, and where the intervention of a human operator would be required (for example when two workspaces depend on two different versions of a same package).

- The errors reported by this predicate **cannot** be auto-fixed
- The reason parameter can be any string of your liking

## Constraint recipes

The following constraints are a good starting point to figure out how to write your own rules. If you build one that you think would be a good fit for this section, open a PR and we'll add them here!

> **Quick note about the Prolog syntax**
>
> Be aware that in prolog `X :- Y` basically means "X is true for each Y that's true". Similarly, know that UpperCamelCase names are variables that get "replaced" by every compatible value possible. Finally, the special variable name `_` simply discards the parameter value.

### Prevent all workspaces from depending on a specific package

```prolog
gen_enforced_dependency_range(WorkspaceCwd, 'tslib', null, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, 'tslib', _, DependencyType).
```

We define a rule that says that for each dependency of each workspace in our project, if this dependency name is `tslib`, then it exists a similar rule of the `gen_enforced_dependency_range` type that forbids the workspace from depending on `tslib`. This will cause the package manager to see that the rule isn't met, and autofix it when requested by removing the dependency from the workspace.

### Prevent two workspaces from depending on conflicting versions of a same dependency

```prolog
gen_invalid_dependency(WorkspaceCwd, DependencyIdent, DependencyType, 'This dependency conflicts with another one from another workspace') :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  workspace_has_dependency(_, DependencyIdent, DependencyRange2, _),
  DependencyRange \= DependencyRange2.
```

We define a `gen_invalid_dependency` rule that is true for each dependency of each package (first `workspace_has_dependency`) if it also exists another dependency of another package (second `workspace_has_dependency`) that has the same name but a different range (`\=` operator).

### Force all workspace dependencies to be made explicit

```prolog
gen_enforced_dependency_range(WorkspaceCwd, DependencyIdent, 'workspace:*', DependencyType) :-
  workspace_ident(_, DependencyIdent),
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType).
```

We define a `gen_enforced_dependency_range` that requires the dependency range `workspace:*` to be used if the dependency name is also the name of a valid workspace. The final `workspace_has_dependency` check is there to ensure that this rule is only applied on workspace that currently depend on the specified workspace in the first place (if it wasn't there, the rule would instead force all workspaces to depend on one another).
