---
category: advanced
path: /advanced/pnpify
title: "Pnpify"
---

## Motivation

Plug'n'Play is, by design, compatible with all projects that only make use of the `require` API - whether it's `require` `require.resolve`, or `createRequireFromPath`. However, some projects like to reimplement the resolution themselves and aren't compatible by default with Plug'n'Play environments (unless they add some specific logic into their resolution). One such project is for example TypeScript, which doesn't natively supports Plug'n'Play yet in its `tsc` binary.

## PnPify

PnPify is a tool designed to workaround this compatibility problem. It's not a perfect solution in that it brings its own set of caveats, but it's often good enough for most use cases. How it works is simple: when a non-PnP compliant project tries to access the `node_modules` directories (for example through `readdir` or `readFile`), PnPify intercepts those calls and converts them into calls to the PnP API. Then, based on the result, it simulates an actual filesystem for the underlying tool to use.

## Usage

Add PnPify to your dependencies:

```
$> yarn add @berry/pnpify
```

Use pnpify to run the incompatible tool:

```
$> yarn pnpify tsc
```

That's all!

## Caveat

Because PnPify doesn't try to do any kind of hoisting, relying exclusively on its fake filesystem might lead to subtle performance issues where, amongst other issues, one package would be instantiated more times than would be needed otherwise. **This is only a problem for bundlers like Webpack**; tools like `tsc` don't suffer from it, because they only need to know about the structural file content and don't actually instantiate the files.

If you want to use PnP with a bundler that doesn't natively support it, we currently recommend you to use the dedicated plugins that we've provided: [`pnp-webpack-plugin`](https://github.com/arcanis/pnp-webpack-plugin) for Webpack, or [`rollup-pnp-resolver`](https://github.com/arcanis/rollup-plugin-pnp-resolve) for Rollup. Those plugins use the PnP API as it is, and thus don't suffer from this optimization problem.
