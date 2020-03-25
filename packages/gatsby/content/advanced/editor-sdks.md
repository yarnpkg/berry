---
category: advanced
path: /advanced/editor-sdks
title: "Editor SDKs"
---

Smart IDEs (such as VSCode or IntelliJ) require special configuration for TypeScript to work. This page intends to be a collection of settings for each editor we've worked with - please contribute to this list!

```toc
# This code block gets replaced with the Table of Contents
```

## Tools currently supported

> **Note:** When using the `--sdk` flag, be aware that only the SDKs for the tools present in your package.json will be installed. Don't forget to run the command again after installing new ones in your project.

| Extension | Required package.json dependency |
|---|---|
| VS Code TypeScript Server | [typescript](https://yarnpkg.com/package/typescript) |
| [vscode-eslint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | [eslint](https://yarnpkg.com/package/eslint) |
| [prettier-vscode extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | [prettier](https://yarnpkg.com/package/prettier) |

If you'd like to contribute more, [take a look here!](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-pnpify/sources/generateSdk.ts)


## Editor setup

### VSCode

1. Add PnPify to your dependencies:

```bash
yarn add @yarnpkg/pnpify
```

2. Run the following command, which will generate a new directory called `.vscode/pnpify`:

```bash
yarn pnpify --sdk
```

3. For safety reason VSCode requires you to explicitly activate the custom TS settings:

  1. Press <kbd>ctrl+shift+p</kbd> in a TypeScript file
  2. Choose "Select TypeScript Version"
  3. Pick "Use Workspace Version"

Your VSCode project is now configured to use the exact same version of TypeScript as the one you usually use, except that it will now be able to properly resolve the type definitions!

Note that VSCode might ask you to do Step 3 again from time to time, but apart from that your experience should be mostly the same as usual. Happy development!

### VIM / coc.nvim

1. Add PnPify to your dependencies:

```bash
yarn add @yarnpkg/pnpify
```

2. Run the following command, which will generate a new directory called `.vscode/pnpify`:

```bash
yarn pnpify --sdk
```

3. Set [`tsserver.tsdk`](https://github.com/neoclide/coc-tsserver#configuration-options) to `.vscode/pnpify/typescript/lib`

## Caveat

- Since the Yarn packages are kept within their archives, editors need to understand how to work with such paths should you want to actually open the files (for example when command-clicking on an import path originating from an external package). This can only be implemented by those editors, and we can't do much more than opening issues to ask for this feature to be implemented (for example, here's the VSCode issue: [#75559](https://github.com/microsoft/vscode/issues/75559)).

  As a workaround, you can run `yarn unplug pkg-name` to instruct yarn to unzip the package, which will re-enable `Go to definition` functionality for the specific package.
