---
id: optional-plugins
title: Optional Plugins
sidebar_label: Optional Plugins
---

Most features available from the Berry platform are implemented through various
plugins. Those plugins can be composed together in order to build a final
binary called a bundle. Yarn itself is simply a collection of plugins for
Berry!

While plugins are typically used directly from the bundle that contains them,
they also can be downloaded separately and dynamically linked with a
precompiled bundle (assuming that the version requirements match). In fact
some plugins are not bundled at all, and downloading them separately is the
best way to leverage the features they add!

## Adding a new plugin

In order to add a plugin, simply run `yarn plugin add <plugin-name>`. Yarn will
then download the specified plugin directly from Github (we don't use the npm
registry for this particular use case) and put it in the `.berry/plugins`
directory.
