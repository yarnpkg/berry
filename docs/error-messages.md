---
id: error-messages
title: Error Messages
sidebar_label: Error Messages
---

### BR0001

An exception has be thrown by the program.

This error typically should never happen (it should instead point to a
different error message from this page so that it can be properly documented),
so it should be considered a bug in the program's implementation. Feel free to
open an issue or, even better, a pull request aiming to fix it.

### BR0002

A package requests a peer dependency, but its parent in the dependency tree
doesn't provide it.

This error occurs when a package peer dependencies cannot be satisfied. If the
peer dependency is optional and shouldn't trigger such warnings, then mark it as
such using the [optional peer dependencies]() feature.

Note that Berry enforces peer dependencies at every level of the dependency
tree - meaning that if A depends on (B,X) and B depends on C and C has a peer
dependency on X, then a warning will be emitted (because B doesn't fulfill the
peer dependendy request). The best way to solve this is to explicitly list the
transitive peer dependency on X in B has well.

### BR0003

Two packages with build scripts have cyclic dependencies.

Cyclic dependencies are a can of worm. They happen when a package A depends on a
package B and vice-versa (they sometime can even be spread across multiple
packages - for example A depends on B which depends on C which depends on A).

While they may work fine in the general case (and in fact Berry won't warn you
about it in most cases), they cause issues as soon as build scripts are
involved. Indeed, in order to build a package, we first must make sure that its
own dependencies have been properly built. How can we do that when two packages
reference each other? Since it cannot be deduced, such patterns will cause the
build scripts of every affected packages to simply be ignored.

There's already good documentation online explaining how to get rid of cyclic
dependencies, the simplest one being to extract the shared part of your program
into a third package without dependencies. So the first case we described would
become A depends on C, B depends on C, C doesn't depend on anything.

### BR0004

A package has build scripts, but they've been disabled across the project.

Build scripts can be disabled on a global basis through the use of the
`enable-scripts` settings. When it happens, a warning is still emitted to let
you know that the installation might not be complete.

The safest way to downgrade the warning into a notification is to explicitly
disable build scripts for the affected packages through the use of the
`dependenciesMeta[].build` key.

### BR0005

A package has build scripts, but they've been disabled through its
configuration.

Build scripts can be disabled on a per-project basis through the use of the
`dependenciesMeta` settings from the `package.json` file. When it happens, a
notification is still emitted to let you know that the installation might not
be complete.

### BR0006

A package has build scripts, but is linked through a soft link.

In Berry's dictionary, a hard link is when a package is owned by the package
manager. In these instances Berry will typically copy packages having build
scripts into a project-local cache so that multiple projects with multiple
dependency trees don't use the same build artifacts. So what's the problem with
so-called "soft links"?

Soft links are when the package manager doesn't own the package source. An
example is a workspace, or a dependency referenced through the `portal:`
specifier. In these instances Berry cannot safely assume that executing
build scripts there is the intended behavior, because it would likely involve
mutating your project or, even worse, an external location on your disk that
might be shared by multiple projects. Since Berry avoids anything unsafe, it
cannot run build scripts on soft links.

There are a few workarounds:

  - Using `file:` instead of `portal:` will cause a hard link to be used instead
    of a soft link. The other side of the coin being that the package will be
    copied into a cache during installs, meaning that changing the package
    source will require you to run `berry install --clear-files` for your
    changes to be taken into account.

  - You can manually run `berry build` from the directory of the affected
    packages. This requires you to know in which order they'll have to be
    called, but is generally the safest option.

  - You can simply abstain from using build scripts with soft links. While this
    suggestion might seem like a bad case of "fix a problem by not encountering
    the problem", consider that build scripts in development might not be of the
    best effect from a developer experience perspective - they usually mean that
    you'll need to run a script before being able to see your changes, which is
    often not what you seek.

### BR0007

A package must be built.

This information message occurs when Berry wishes to let you know that a package
will need to be built in order for the installation to complete. This usually
occurs in only two cases: either the package never has been built before, or its
previous build failed (returned a non-zero exit code).

### BR0008

A package must be rebuilt.

This information message occurs when Berry wishes to let you know that a package
will need to be rebuilt in order for the installation to complete. This usually
occurs in a single case: when the package's dependency tree has changed. Note
that this also include its transitive dependencies, which sometimes may cause
surprising rebuilds (for example, if A depends on B that depends on C@1, and if
Berry decides for some reason to bump C to C@2, then A will need to be rebuilt).

### BR0009

A package build failed.

This problem typically doesn't come from Berry itself, and simply mean that a
package described as having build directives couldn't get built successfully.

To see the actual error message, read the file linked in the report. It will
contain the full output of the failing script.

### BR0010

A resolver cannot be found for the given package.

Resolvers are the components tasked from converting ranges (`^1.0.0`) into
references (`1.2.3`). They each contain their own logic to do so - the semver
resolver is the most famous one but far from being the only one. The GitHub
resolver transforms GitHub repositories into tarball urls, the Git resolver
normalizes the paths sent to git, ... each resolver takes care of a different
resolution strategy. A missing resolver means that one of those strategies is
missing.

This error is usually caused by a Berry plugin being missing. Plugins are the
most common way to ship new resolvers to Berry.

### BR0011

A fetcher cannot be found for the given package.

Fetchers are the components that take references and fetch the source code from
the remote location. A semver fetcher would likely fetch the packages from some
registry, while a workspace fetcher would simply redirect to the location on
the disk where the sources can be found.

This error is usually caused by a Berry plugin being missing. Plugins are the
most common way to ship new resolvers to Berry.

### BR0012

A linker cannot be found for the given package.

Linkers are the components tasked from extracting the sources from the
artifacts returned by the fetchers and putting them on the disk in a manner
that can be understood by the target environment. The Node linker would use
the Plug'n'Play strategy, while a PHP linker would use an autoload strategy
instead.

This error is usually caused by a Berry plugin being missing. Plugins are the
most common way to ship new resolvers to Berry.
