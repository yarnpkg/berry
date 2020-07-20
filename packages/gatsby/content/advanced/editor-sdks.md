---
category: advanced
path: /advanced/editor-sdks
title: "Editor SDKs"
---

Smart IDEs (such as VSCode or IntelliJ) require special configuration for TypeScript to work. This page intends to be a collection of settings for each editor we've worked with - please contribute to this list!

The editor SDKs and settings can be generated using the `yarn pnpify --sdk` (or `yarn dlx @yarnpkg/pnpify --sdk` if you don't need to install it locally) command. Its detailed documentation can be found on the [dedicated page](/pnpify/cli/--sdk).
Generally speaking:
- Use `yarn pnpify --sdk vscode vim` to generate both the base SDKs and the settings for the specified supported editors.
- Use `yarn pnpify --sdk base` to generate the base SDKs and then manually tweak the configuration of unsupported editors.
- Use `yarn pnpify --sdk` to update all installed SDKs and editor settings.

---

```toc
# This code block gets replaced with the Table of Contents
```

## Tools currently supported

> **Note:** When using the `--sdk` flag, be aware that only the SDKs for the tools present in your *root* package.json will be installed (the tool won't look at the dependencies from your other workspaces). So don't forget to run the command again should you change the set of tools used by your project!

| Extension | Required `package.json` dependency |
|---|---|
| Builtin VSCode TypeScript Server | [typescript](https://yarnpkg.com/package/typescript) |
| [vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | [eslint](https://yarnpkg.com/package/eslint) |
| [prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | [prettier](https://yarnpkg.com/package/prettier) |
| [vscode-stylelint](https://marketplace.visualstudio.com/items?itemName=stylelint.vscode-stylelint) | [stylelint](https://stylelint.io/)

If you'd like to contribute more, [take a look here!](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-pnpify/sources/generateSdk.ts)


## Editor setup

### VSCode

1. Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/pnpify --sdk vscode
```

2. For safety reason VSCode requires you to explicitly activate the custom TS settings:

  1. Press <kbd>ctrl+shift+p</kbd> in a TypeScript file
  2. Choose "Select TypeScript Version"
  3. Pick "Use Workspace Version"

Your VSCode project is now configured to use the exact same version of TypeScript as the one you usually use, except that it will now be able to properly resolve the type definitions!

Note that VSCode might ask you to do Step 3 again from time to time, but apart from that your experience should be mostly the same as usual. Happy development!

### VIM / coc.nvim

Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/pnpify --sdk vim
```

### Emacs

The SDK comes with a typescript-language-server wrapper which enables you to use the ts-ls LSP client.

1. Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/pnpify --sdk base
```

2. Create a `.dir-locals.el` with the following content to enable Flycheck and LSP support and make sure LSP is loaded after local variables are applied to trigger the `eval-after-load`:

```lisp
((typescript-mode
  . (
     ;; Enable typescript-language-server and eslint LSP clients.
     (lsp-enabled-clients . (ts-ls eslint))
     (eval . (lexical-let ((project-directory (car (dir-locals-find-file default-directory))))
               (set (make-local-variable 'flycheck-javascript-eslint-executable)
                    (concat project-directory ".yarn/sdks/eslint/bin/eslint.js"))

               (eval-after-load 'lsp-clients
                 '(progn
                    (plist-put lsp-deps-providers
                               :local (list :path (lambda (path) (concat project-directory ".yarn/sdks/" path))))))

               (lsp-dependency 'typescript-language-server
                               '(:local "typescript-language-server/lib/cli.js"))
               (lsp-dependency 'typescript
                               '(:local "typescript/bin/tsserver"))

               ;; Re-(start) LSP to pick up the dependency changes above. Or use
               ;; `hack-local-variables-hook` as proposed in lsp-mode's FAQ:
               ;; https://emacs-lsp.github.io/lsp-mode/page/faq/
               ;; (lsp)
               )))))
```

3. Do note, that you can rename `:local` as you'd like in case you have SDKs stored elsewhere (other than `.yarn/sdks/...`) in other projects.

## Caveat

- Since the Yarn packages are kept within their archives, editors need to understand how to work with such paths should you want to open the files (for example when command-clicking on an import path originating from an external package). This can only be implemented by those editors, and we can't do much more than opening issues to ask for this feature to be implemented (for example, here's the VSCode issue: [#75559](https://github.com/microsoft/vscode/issues/75559)).

  As a workaround, you can run `yarn unplug pkg-name` to instruct yarn to unzip the package, which will re-enable `Go to definition` functionality for the specific package.
