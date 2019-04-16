---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
---

The version of Yarn this website is about is the v2 - being slightly experimental, its install process is different from our regular builds. In order to install it:

1. First install the regular Yarn by following [the instructions from the v1 website](https://yarnpkg.com/en/docs/install).

2. Go into your project (that you created either manually or via `yarn init`) and run the following:

   ```
   $> yarn policies set-version v2
   ```

3. Test that the v2 has been properly selected by running:

   ```
   $> yarn --version
   v2.0.0
   ```
