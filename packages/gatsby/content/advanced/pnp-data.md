---
category: advanced
path: /advanced/pnp-spec
title: "PnP Specification"
description: In-depth documentation of the PnP spec.
---

```toc
# This code block gets replaced with the Table of Contents
```

## About this document

To make interoperability easier for third-party projects, this document describes the specification we follow when installing files on disk under the [Plug'n'Play install strategy](/features/pnp). It also means:

- any change we make to this document will follow semver rules
- we'll do our best to preserve backward compatibility
- new features will be intended to gracefully degrade

## High-level idea

Plug'n'Play works by keeping in memory a table of all packages part of the dependency tree, in such a way that we can easily answer two different questions:

- Given a path, what package does it belong to?
- Given a package, where are the dependencies it can access?

Resolving a package import thus becomes a matter of interlacing those two operations:

- First, locate which package is requesting the resolution
- Then retrieve its dependencies, check if the requested package is amongst them
- If it is, then retrieve the dependency information, and return its location

Extra features can then be designed, but are optional. For example, Yarn leverages the information it knows about the project to throw semantic errors when a dependency cannot be resolved: since we know the state of the whole dependency tree, we also know why a package may be missing.

## Basic concepts

All packages are uniquely referenced by **locators**. A locator is a combination of a **package ident**, which includes its scope if relevant, and a **package reference**, which can be seen as a unique ID used to distinguish different instances (or versions) of a same package. The package references should be treated as an opaque value: it doesn't matter from a resolution algorithm perspective that they start with `workspace:`, `virtual:`, `npm:`, or any other protocol.

## Fallback

For improved compatibility with legacy codebases, Plug'n'Play supports a feature we call "fallback". The fallback triggers when a package makes a resolution request to a dependency it doesn't list in its dependencies. In normal circumstances the resolver would throw, but when the fallback is enabled the resolver should first try to find the dependency packages amongst the dependencies of a set of special packages. If it finds it, it then returns it transparently.

In a sense, the fallback can be seen as a limited and safer form of hoisting. While hoisting allows unconstrainted access through multiple levels of dependencies, the fallback requires to explicitly define a fallback package - usually the top-level one.

## Manifest reference

When [`pnpEnableInlining`](/configuration/yarnrc#pnpEnableInlining) is explicitly set to `false`, Yarn will generate an additional `.pnp.data.json` file containing the following fields.

Note that this document only covers the data file itself - you should define your own in-memory data structures, populated at runtime with the information from the manifest. For example, Yarn turns the `packageRegistryData` table into two separate memory tables: one that maps a path to a package, and another that maps a package to a path.

import pnpSchema from '@yarnpkg/gatsby/static/configuration/pnp.json';
import theme     from 'prism-react-renderer/themes/vsDark';
import {JsonDoc} from 'react-json-doc';

<JsonDoc theme={theme} extraTheme={{
  container: {borderRadius: `var(--ifm-code-border-radius)`},
  inactiveHeader: {},
  activeHeader: {borderRadius: `var(--ifm-code-border-radius)`, background: `#3d437c`},
  annotation: {borderRadius: `var(--ifm-code-border-radius)`, background: `#383944`, color: `#ffffff`},
  anchor: {scrollMarginTop: 60},
  section: {fontFamily: `SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`},
}} data={pnpSchema}/>
