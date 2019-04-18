---
category: advanced
path: /advanced/migration
title: "Migration"
---

Yarn v2 is a very different software from the v1. While one of our aim is to make the transition as easy as possible, some behaviors had to be changed. To make things easier we've documented the most common problems that may arise when porting from one project to the other, along with suggestions to keep moving forward.

## Yarnrc file detection

The Yarnrc files mechanisms have been changed and simplified. In particular:

  - Yarn doesn't use the configuration from your `.npmrc` files anymore; we instead read all of our configuration from the `.yarnrc` files whose available settings can be found in [our documentation](/configuration/yarnrc).

  - To simplify the configuration process, Yarn doesn't look anywhere else than in the folder hierarchy for rc files. We do not read the XDG directory, and we do not try to read the user configuration when the repository is cloned outside of the home folder. Our recommendation is to avoid nested configuration and list exactly one `.yarnrc` per project (at the root of the repository).

## Yarnrc settings

The settings available in the yarnrc file have changed. Using old settings will cause Yarn to throw an exception at boot time unless properly guarded.

We recommend you to make sure you only use [modern settings](/configuration/yarnrc) if possible. In case a particular feature you relied on in the v1 is missing in the v2, feel free to open an issue on our repository to discuss whether we should add it back.

If you absolutely need to keep in your file hierarchy some v1 settings, you can use the special field named `berry`. Should Yarn v2+ find this field, it will use its content and ignore any other field. For example, the following file will work as expected on both the v1 and v2+ branches:

```yaml
workspaces-experimental true

berry:
  enable-global-cache true
```

## Plug'n'Play

Starting from the v2, Plug'n'Play is enabled by default. This might cause compatibility issues in a few corner cases for projects that kept relying on unsafe pattern. Keep an eye on the [dedicated page](/features/pnp), and try to avoid those projects until they correct the situation. Also feel free to open an issue on Yarn's repository as well so that we can keep track of them and offer our help.
