---
id: compiling-a-bundle
title: Compiling Berry
sidebar_label: Compiling Berry
---

Berry is a modular package manager platform, and many of its features are
implemented through plugins. In order to make it easier to distribute a
package manager adapted to your use case, we support generating specialized
bundles that ship with a set of builtin plugins of your choice.

To use this feature, simply clone Berry from its repository, go inside it, then
run `berry build:cli --profile standard`.
