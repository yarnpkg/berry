---
category: protocols
slug: /protocol/link
title: "Link Protocol"
description: How link dependencies work in Yarn.
---

The `link:` protocol lets you connect your project to an external directory.

```
yarn add imgs@link:./static/imgs
```

## Links vs portals

Since the target referenced by `link:` may not exist until postinstall scripts have run, and since Yarn guarantees a predictable behavior regardless of the execution order, we need to disambiguate *packages* (which contain `package.json` files, and may list dependencies of their own) from *arbitrary folders* (which may not).

In practice, this means that `link:` dependencies can only point to arbitrary folders - in other words, whatever it references cannot have a `package.json` file, and thus can't have dependencies. If you need to symlink to a *package*, use [portals](/protocol/portal) instead.
