# @yarnpkg/builder

A CLI tool designed for creating, building, and managing complex plugins.

> This version of the builder is for creating plugins for Yarn 3.x. Yarn 3 plugins are not compatible with Yarn 2 installations, however Yarn 2 plugins are usually compatible with Yarn 3. If you wish to create plugins for Yarn 2, please use v2.x of the builder (`yarn add @yarnpkg/builder@^2`).

## Features

- `builder new plugin` command for scaffolding new plugins
- `builder build plugin` command for building complex plugins
- supports TypeScript out-of-the-box
- uses ESBuild internally, providing treeshaking, minification, and various other optimizations out-of-the-box

## Installation

`yarn add -D @yarnpkg/builder`

## Commands

- [`builder new plugin`](https://yarnpkg.com/cli/builder/new/plugin) - Create a new plugin.

- [`builder build plugin`](https://yarnpkg.com/cli/builder/build/plugin) - Build a local plugin.

- [`builder build bundle`](https://yarnpkg.com/cli/builder/build/bundle) - Build a yarn.js bundle from our repository **(internal)**.
