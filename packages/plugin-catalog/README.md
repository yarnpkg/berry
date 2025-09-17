# `@yarnpkg/plugin-catalog`

This plugin adds support for centralized dependency version management through catalogs, similar to pnpm's catalog feature.

It hooks into:
- `reduceDependency` and replaces catalog ranges with the ones defined in a catalog.
- `beforeWorkspacePacking` replacing catalogs with actual ranges before packing

## Install

This plugin is included by default starting from Yarn 4.10.0.

## Usage

### Default Catalog

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

### Named Catalogs

You can define multiple named catalogs for different purposes:

```yaml
# Default catalog
catalog:
  lodash: ^4.17.21
  typescript: ~4.9.0

# Named catalogs
catalogs:
  react18:
    react: ^18.3.1
    react-dom: ^18.3.1

  react17:
    react: ^17.0.2
    react-dom: ^17.0.2

  vue3:
    vue: ^3.4.0
    vuex: ^4.1.0
```

Then reference them in your `package.json`:

```json
{
  "dependencies": {
    "lodash": "catalog:",
    "react": "catalog:react18",
    "vue": "catalog:vue3"
  }
}
```

The comprehensive feature documentation can be found in `packages/docusaurus/docs/features/catalog.mdx`.
