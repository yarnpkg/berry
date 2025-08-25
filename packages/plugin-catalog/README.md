# `@yarnpkg/plugin-catalog`

This plugin adds support for centralized dependency version management through catalogs.

## Install

This plugin is included by default starting from Yarn 4.10.

## Usage

Define a catalog in your `.yarnrc.yml`:

```yaml
catalog:
  react: ^18.0.0
  lodash: ^4.17.21
```

Then reference catalog entries in your `package.json`:

```json
{
  "dependencies": {
    "react": "catalog:",
    "lodash": "catalog:"
  }
}
```
```

The comprehensive feature documentation should go in `packages/docusaurus/docs/features/catalog.mdx` following the same pattern as other feature docs in that directory.
