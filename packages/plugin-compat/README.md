# `@yarnpkg/plugin-compat`

This plugin contains various builtin patches that will be applied to packages that aren't compatible with the Plug'n'Play resolution out-of-the-box.

## Install

This plugin is included by default in Yarn.

## Compatibility Features

- [`typescript`](https://yarnpkg.com/package?typescript): Auto-merge of [#35206](https://github.com/microsoft/TypeScript/pull/35206)
- [`resolve`](https://yarnpkg.com/package/?resolve): Implements [`normalize-options.js`](https://github.com/browserify/resolve/pull/174)
