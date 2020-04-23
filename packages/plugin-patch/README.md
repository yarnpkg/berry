# `@yarnpkg/plugin-patch`

This plugin adds support for the `patch:` protocol.

## Install

This plugin is included by default in Yarn.

## Usage

1. Run `yarn patch <package name>` and edit the resulting folder.

2. Once you're reading, run `yarn patch-commit <patch folder>`, and store the result inside a `.patch` file.

3. Add the `patch:` protocol to your dependencies as such:

```json
{
  "dependencies": {
    "lodash": "patch:lodash@1.0.0#./my-patch-file.patch"
  }
}
```

## Caveat

You cannot add dependencies through the `patch:` protocol. Check this [FAQ entry](https://yarnpkg.com/features/protocols#why-cant-i-add-dependencies-through-the-patch-protocol) for more details.
