---
category: advanced
path: /advanced/lexicon
title: "Lexicon"
---

<!-- Note that all entries within this file must be alphabetically sorted -->

### Descriptor

A descriptor is a combination of a package name (for example `lodash`) and a package <abbr>range</abbr> (for example `^1.0.0`). Descriptors are used to identify a set of packages rather than one unique package.

### Fetcher

Fetchers are the components tasked from extracting the full package data from a <abbr>reference</abbr>. For example, the npm fetcher would download the package tarballs from the npm registry.

See also: [Architecture](/advanced/architecture)

### Linker

Linkers are the components that consume both a dependency tree and a store of package data, and generate in return disk artifacts specific to the environment they target. For example, the <abbr>Plug'n'Play</abbr> linker generates a single `.pnp.js` file.

See also: [Architecture](/advanced/architecture)

### Locator

A locator is a combination of a package name (for example `lodash`) and a package <abbr>reference</abbr> (for example `1.2.3`). Locators are used to identify a single unique package (interestingly, all valid locators also are valid <abbr>descriptors</abbr>).

### Manifest

A manifest is a `package.json` file.

### Plugin

Plugins are a new concept introduced in Yarn 2+. Through the use of plugins Yarn can be extended and made even more powerful - whether it's through the addition of new <abbr>resolvers</abbr>, <abbr>fetchers</abbr>, or <abbr>linkers</abbr>.

See also: [Plugins](/features/plugins)

### Plug'n'Play

Plug'n'Play is an alternative installation strategy that, instead of generating the typical `node_modules` directories, generate one single file that is then injected into Node to let it know where to find the installed packages. Starting from the v2, Plug'n'Play became the default strategy for Javascript projects.

See also: [Plug'n'Play](/features/pnp)

### PnP

See Plug'n'Play

### Project

The term project is used to encompass all the <abbr>worktrees</abbr> that belong to the same dependency tree.

See also: [Workspaces](/features/workspaces)

### Range

A range is a string that, when combined with a package name, can be used to select multiple versions of a single package. Ranges typically follow <abbr>semver</abbr>, but can use any of the supported Yarn protocols.

See also: [Protocols](/features/protocols)

### Reference

A reference is a string that, when combined with a package name, can be used to select one single version of a single package. References typically follow <abbr>semver</abbr>, but can use any of the supported Yarn protocols.

See also: [Protocols](/features/protocols)

### Resolver

Resolvers are the components tasked from converting <abbr>descriptors</abbr> into <abbr>locators</abbr>, and extracting the package <abbr>manifests</abbr> from the package <abbr>locators</abbr>. For example, the npm resolver would check what versions are available on the npm registry and return all the candidates that satisfy the <abbr>semver</abbr> requirements, then would query the npm registry to fetch the full metadata associated to the selected resolution.

See also: [Architecture](/advanced/architecture)

### Scope

Scopes are a term linked inherited from the npm registry; they are used to describe a set of packages that all belong to the same entity. For example, all the Yarn packages related to the v2 belong to the `berry` scope on the npm registry. Scopes are traditionally prefixed with the `@` symbol.

### Yarn

Yarn is a command line tool used to manage programming environments. Written in Javascript, it is mostly used along with others Javascript projects, but has capabilities that make it suitable to be used in various situations.

### Workspace

Generally speaking, workspaces are a Yarn features used to work on multiple projects stored within the same repository.

In the context of Yarn's vocabulary, workspaces are packages that are of a single <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Worktree

A worktree is a private workspace that adds new child workspaces to the current <abbr>project</abbr>.

See also: [Workspaces](/features/workspaces)

### Zero-Install

See also: [Zero-Install](/features/zero-installs)
