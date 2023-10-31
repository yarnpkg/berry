---
category: getting-started
slug: /migration/overview
title: "Benefits"
description: Learn why the Yarn team recommends to migrate from Yarn 1.x to modern releases.
sidebar_position: 1
---

While the Yarn Classic line (1.x) remains a pillar of the JavaScript ecosystem, we recommend upgrading if possible. Why's that?

- **Stability:** Yarn Modern came after **years** of experience with maintaining Classic; its design was informed by the shortcomings we saw, and as a result the software is much more stable than it ever was.

- **New features:** Yarn Modern provides many new features that didn't exist in Yarn 1.x - or any other package managers for that matter. As an example, [Constraints](/features/constraints) are exclusive to Yarn Modern.

- **Flexibility:** Yarn Modern supports all three installation strategies: Yarn PnP, `node_modules`, and via a pnpm-like content-addressed cache. No matter which one you prefer, you have it at your disposal.

- **Extensibility:** Yarn Modern's architecture allows you to build your own features as you need it. No need to wait for us to implement this feature you hope for - you can now implement it yourself, according to your own specs, and use it straight away! Focused workspaces, custom installs, project validation, ...

- **Future proof:** Yarn Modern was built after we started to see how difficult it was to build new features on Yarn Classic, with most changes having unpredictable consequences. This plateau has been solved, as evidenced by the slate of features that we released in the past few major releases.
