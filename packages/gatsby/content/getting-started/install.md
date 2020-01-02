---
category: getting-started
path: /getting-started/install
title: "2 - Installation"
---

## Global Install

1. Install [Node.js](https://nodejs.org/en/download/)

2. Install Yarn:

   ```
   npm install -g yarn
   ```

3. Test that Yarn 2 has been properly installed by running the following, which should yield "v2.0.0" or similar:

   ```bash
   yarn --version
   ```

## Per-project install

1. Follow the global install instructions

2. Move into your project folder:

  ```bash
  cd ~/path/to/project
  ```

3. Run the following command:

  ```bash
  yarn policies set-version berry
  ```

4. Commit the `.yarn` and `.yarnrc.yml` changes
