---
category: getting-started
path: /getting-started/editor-sdks
title: "Editor SDKs"
description: An overview of the editor SDKs used to bring PnP compatibility to editors.
---

Smart IDEs (such as VSCode or IntelliJ) require special configuration for TypeScript to work when using [Plug'n'Play installs](https://yarnpkg.com/features/pnp). This page intends to be a collection of settings for each editor we've worked with - please contribute to this list!

The editor SDKs and settings can be generated using `yarn dlx @yarnpkg/sdks` (or `yarn sdks` if you added `@yarnpkg/sdks` to your dependencies). Its detailed documentation can be found on the [dedicated page](/sdks/cli/default).
Generally speaking:
- Use `yarn sdks vscode vim` to generate both the base SDKs and the settings for the specified supported editors.
- Use `yarn sdks base` to generate the base SDKs and then manually tweak the configuration of unsupported editors.
- Use `yarn sdks` to update all installed SDKs and editor settings.

---

```toc
# This code block gets replaced with the Table of Contents
```

## Tools currently supported

> **Note:** Be aware that only the SDKs for the tools present in your *root* package.json will be installed (the tool won't look at the dependencies from your other workspaces). So don't forget to run the command again should you change the set of tools used by your project!

| Extension | Required `package.json` dependency |
|---|---|
| Builtin VSCode TypeScript Server | [typescript](https://yarnpkg.com/package/typescript) |
| [vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) | [eslint](https://yarnpkg.com/package/eslint) |
| [prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) | [prettier](https://yarnpkg.com/package/prettier) |
| [flow-for-vscode*](https://marketplace.visualstudio.com/items?itemName=flowtype.flow-for-vscode) | [flow-bin](https://flow.org/) |

> \* Flow is currently [incompatible with PnP](/features/pnp#incompatible).

If you'd like to contribute more, [take a look here!](https://github.com/yarnpkg/berry/blob/master/packages/yarnpkg-sdks/sources/generateSdk.ts)


## Editor setup

### VSCode

To support features like go-to-definition a plugin like [ZipFS](https://marketplace.visualstudio.com/items?itemName=arcanis.vscode-zipfs) is needed.

1. Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/sdks vscode
```

2. For safety reason VSCode requires you to explicitly activate the custom TS settings:

  1. Press <kbd>ctrl+shift+p</kbd> in a TypeScript file
  2. Choose "Select TypeScript Version"
  3. Pick "Use Workspace Version"

Your VSCode project is now configured to use the exact same version of TypeScript as the one you usually use, except that it will now be able to properly resolve the type definitions!

Note that VSCode might ask you to do Step 3 again from time to time, but apart from that your experience should be mostly the same as usual. Happy development!

### VIM

To support features like go-to-definition a plugin like [vim-rzip](https://github.com/lbrayner/vim-rzip) is needed.

#### coc.nvim

Run the following command, which will generate a new directory called `.yarn/sdks` and create a `.vim/coc-settings.json` file:

```bash
yarn dlx @yarnpkg/sdks vim
```

#### Neovim Native LSP

Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/sdks base
```

With the `.yarn/sdks` in place TypeScript support should work out of the box with [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) and [theia-ide/typescript-language-server](https://github.com/theia-ide/typescript-language-server).

##### Supporting go-to-definition et al.

> **Note:** Requires Neovim version >=0.6

As well as the [vim-rzip](https://github.com/lbrayner/vim-rzip) plugin you'll also need the following snippet to handle Yarn PnP's URIs emitted from [theia-ide/typescript-language-server](https://github.com/theia-ide/typescript-language-server). See [lbrayner/vim-rzip#15](https://github.com/lbrayner/vim-rzip/issues/15) for further details.

```vim
" Decode URI encoded characters
function! DecodeURI(uri)
    return substitute(a:uri, '%\([a-fA-F0-9][a-fA-F0-9]\)', '\=nr2char("0x" . submatch(1))', "g")
endfunction

" Attempt to clear non-focused buffers with matching name
function! ClearDuplicateBuffers(uri)
    " if our filename has URI encoded characters
    if DecodeURI(a:uri) !=# a:uri
        " wipeout buffer with URI decoded name - can print error if buffer in focus
        sil! exe "bwipeout " . fnameescape(DecodeURI(a:uri))
        " change the name of the current buffer to the URI decoded name
        exe "keepalt file " . fnameescape(DecodeURI(a:uri))
        " ensure we don't have any open buffer matching non-URI decoded name
        sil! exe "bwipeout " . fnameescape(a:uri)
    endif
endfunction

function! RzipOverride()
    " Disable vim-rzip's autocommands
    autocmd! zip BufReadCmd   zipfile:*,zipfile:*/*
    exe "au! zip BufReadCmd ".g:zipPlugin_ext

    " order is important here, setup name of new buffer correctly then fallback to vim-rzip's handling
    autocmd zip BufReadCmd   zipfile:*  call ClearDuplicateBuffers(expand("<afile>"))
    autocmd zip BufReadCmd   zipfile:*  call rzip#Read(DecodeURI(expand("<afile>")), 1)

    if has("unix")
        autocmd zip BufReadCmd   zipfile:*/*  call ClearDuplicateBuffers(expand("<afile>"))
        autocmd zip BufReadCmd   zipfile:*/*  call rzip#Read(DecodeURI(expand("<afile>")), 1)
    endif

    exe "au zip BufReadCmd ".g:zipPlugin_ext."  call rzip#Browse(DecodeURI(expand('<afile>')))"
endfunction

autocmd VimEnter * call RzipOverride()
```

### Emacs

The SDK comes with a typescript-language-server wrapper which enables you to use the ts-ls LSP client.

1. Run the following command, which will generate a new directory called `.yarn/sdks`:

```bash
yarn dlx @yarnpkg/sdks base
```

2. Create a `.dir-locals.el` with the following content to enable Flycheck and LSP support and make sure LSP is loaded after local variables are applied to trigger the `eval-after-load`:

```lisp
((typescript-mode
  . ((eval . (let ((project-directory (car (dir-locals-find-file default-directory))))
                (setq lsp-clients-typescript-server-args `("--tsserver-path" ,(concat project-directory ".yarn/sdks/typescript/bin/tsserver") "--stdio")))))))
```

3. Do note, that you can rename `:local` as you'd like in case you have SDKs stored elsewhere (other than `.yarn/sdks/...`) in other projects.

## Caveat

- Since the Yarn packages are kept within their archives, editors need to understand how to work with such paths should you want to open the files (for example when command-clicking on an import path originating from an external package). This can only be implemented by those editors, and we can't do much more than opening issues to ask for this feature to be implemented (for example, here's the VSCode issue: [#75559](https://github.com/microsoft/vscode/issues/75559)).

  As a workaround, you can run `yarn unplug pkg-name` to instruct yarn to unzip the package, which will re-enable `Go to definition` functionality for the specific package.
