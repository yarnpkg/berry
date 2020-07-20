# @yarnpkg/builder

A CLI tool designed for creating, building, and managing complex plugins.

## Features

- `builder new plugin` command for scaffolding new plugins
- `builder build bundle` command for building complex plugins
- supports TypeScript out-of-the-box
- supports custom Babel configurations out-of-the-box
- uses Webpack internally, providing treeshaking, minification, and various other optimizations out-of-the-box

## Installation

`yarn add -D @yarnpkg/builder typescript`

## Commands

- [`build bundle`](/builder/cli/build/bundle) - Build the local bundle.

- [`build plugin`](/builder/cli/build/plugin) - Build a local plugin.

- [`new plugin`](/builder/cli/new/plugin) - Create a new plugin.