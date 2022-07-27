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

## Resolution algorithm

Note: for simplicity, this algorithm doesn't mention all the Node.js features that allow mapping a module to another, such as [`imports`](https://nodejs.org/api/packages.html#imports), [`exports`](https://nodejs.org/api/packages.html#exports), or other vendor-specific features.

### NM_RESOLVE(*specifier*, *parentURL*)

1. This function is specified in the [Node.js documentation](https://nodejs.org/api/esm.html#resolver-algorithm-specification)

### PNP_RESOLVE(*specifier*, *parentURL*)

1. Let *resolved* be **undefined**

2. If *specifier* is a Node.js builtin, then

    1. Set *resolved* to *specifier* itself and return it
  
3. Otherwise, if *specifier* starts with "/", "./", or "../", then

    1. Set *resolved* to **NM_RESOLVE**(*specifier*, *parentURL*) and return it

4. Otherwise,

    1. Note: *specifier* is now a bare identifier

    2. Let *unqualified* be **RESOLVE_TO_UNQUALIFIED**(*specifier*, *parentURL*)

    3. Set *resolved* to **NM_RESOLVE**(*unqualified*, *parentURL*)

### RESOLVE_TO_UNQUALIFIED(*specifier*, *parentURL*)

1. Let *resolved* be **undefined**

2. Let *ident* be the package scope and name from *specifier*

3. Let *manifest* be **FIND_PNP_MANIFEST**(*parentURL*)

4. If *manifest* is null, then

    1. Set *resolved* to **NM_RESOLVE**(*specifier*, *parentURL*) and return it

5. Let *parentLocator* be **FIND_LOCATOR**(*manifest*, *parentURL*)

6. If *parentLocator* is null, then

    1. Set *resolved* to **NM_RESOLVE**(*specifier*, *parentURL*) and return it

7. Let *parentPkg* be **GET_PACKAGE**(*manifest*, *parentLocator*)

8. Let *reference* be the entry from *parentPkg.packageDependencies* referenced by *ident*

9. If *dependency* is null, then

    1. If *manifest.enableTopLevelFallback* is **true**, then

        1. If *parentLocator* **isn't** in *manifest.fallbackExclusionList*, then

            1. Set *resolved* to **RESOLVE_VIA_FALLBACK**(*manifest*, *specifier*) and return it

    2. Throw a resolution error

10. Otherwise,

    1. Let *dependencyPkg* be **GET_PACKAGE**(*manifest*, {*ident*, *reference*})

    2. Let *modulePath* be everything that follows *ident* in *specifier* 

    2. Return *dependencyPkg.packageLocation* concatenated with *modulePath*

### FIND_LOCATOR(*manifest*, *url*)

Note: The algorithm described here is quite inefficient. You should make sure to prepare data structure more suited for this task when you read the manifest.

1. Let *bestLength* be 0

2. Let *bestLocator* be **null**

3. Let *relativeUrl* be the relative path between *manifest* and *url*

    1. Note: Make sure it always starts with a `./` or `../`

4. If *relativeUrl* matches *manifest.ignorePatternData*, then

    1. Return **null**

5. For each *registryPkg* entry in *manifest.packageRegistryData*

    1. If *registryPkg.discardFromLookup* **isn't true**, then

        1. If *registryPkg.packageLocation.length* is greater than *bestLength*, then

            1. If *url* starts with *registryPkg*, then

                1. Set *bestLength* to *registryPkg.packageLocation.length*

                2. Set *bestLocator* to the current *registryPkg* locator

6. Return *bestLocator*

### RESOLVE_VIA_FALLBACK(*manifest*, *specifier*)

1. For each *fallbackLocator* in *manifest.packageRegistryData*

    1. Let *fallbackPkg* be **GET_PACKAGE**(*manifest*, *fallbackLocator*)

    2. Let *fallbackPath* be *fallbackPkg.packageLocation* turned absolute

    3. Let *resolved* be **PNP_RESOLVE**(*specifier*, *fallbackPath*)

    4. If the previous step threw an error, ignore it

    5. Otherwise,

        1. Return *resolved*

2. Otherwise,

    1. Return **null**

### FIND_PNP_MANIFEST(*url*)

1. Let *manifest* be **null**

2. Let *directoryPath* be the directory for *url*

3. Let *pnpPath* be *directoryPath* concatenated with */.pnp.cjs*

4. If *pnpPath* exists on the filesystem, then

    1. Let *pnpDataPath* be *directoryPath* concatenated with */.pnp.data.json*

    2. Set *manifest* to *JSON.parse(readFile(pnpDataPath))* and return it

5. Otherwise, if *directoryPath* is */*, then

    1. Return **null**

6. Otherwise,

    1. Return **FIND_PNP_MANIFEST**(*directoryPath*)
