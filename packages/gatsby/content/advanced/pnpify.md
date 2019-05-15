---
category: advanced
path: /advanced/pnpify
title: "PnPify"
---

## Motivation

Plug'n'Play is, by design, compatible with all projects that only make use of the `require` API - whether it's `require`, `require.resolve`, or `createRequireFromPath`. However, some projects like to reimplement the resolution themselves and aren't compatible by default with our environment (unless they add some specific lines into their resolution logic). One such project is for example TypeScript, which doesn't natively supports Plug'n'Play in its `tsc` binary at the time of this writing ([#28289](https://github.com/Microsoft/TypeScript/issues/28289)).

## PnPify

PnPify is a tool designed to workaround these compatibility issues. It's not perfect in that it brings its own set of caveats and doesn't allow you to leverage all the features that PnP has to offer, but it's often good enough to unblock you until better solutions are implemented.

How it works is simple: when a non-PnP-compliant project tries to access the `node_modules` directories (for example through `readdir` or `readFile`), PnPify intercepts those calls and converts them into calls to the PnP API. Then, based on the result, it simulates an actual filesystem for the underlying tool to use.

## Usage

1. Add PnPify to your dependencies:

   ```
   $> yarn add @berry/pnpify
   ```

2. Use pnpify to run the incompatible tool:

   ```
   $> yarn pnpify tsc
   ```

## VSCode Support

PnPify also is compatible with VSCode! Follow those steps to enable it:

1. Add PnPify to your dependencies:

   ```
   $> yarn add @berry/pnpify
   ```

2. Run the following command, which will generate a new directory called `tssdk`:

   ```
   $> yarn pnpify --sdk
   ```

3. For safety reason VSCode requires you to explicitly activate the custom TS settings:

    1. Press <kbd>ctrl+shift+p</kbd> in a TypeScript file
    2. Choose "Select TypeScript Version"
    3. Pick "Use Workspace Version"

Your VSCode project is now configured to use the exact same version of TypeScript as the one you usually use, except that it will now be able to properly resolve the type definitions!

Note that VSCode might ask you to do Step 4 again from time to time, but apart from that your experience should be the same as usual. Happy development!

## Caveat

- Due to how PnPify emulates the `node_modules` directory, some problems are to be expected with packages listing peer dependencies.

- Since the files don't actually exist on the disk, it will mess with watch mechanisms (modifications in files from your project will be properly picked up, but dependencies being added or removed might not be picked up by the engine). We're considering adding support for `fs.watchFile` even for dependencies, but it will require significant work.

## Alternatives

- A non-official VSCode extension called [`TypeScript Plug'n'Play`](https://marketplace.visualstudio.com/items?itemName=ark120202.vscode-typescript-pnp-plugin) is maintained by [@ark120202](https://github.com/ark120202/vscode-typescript-pnp-plugin) and add PnP support to VSCode in a more integrated way.
