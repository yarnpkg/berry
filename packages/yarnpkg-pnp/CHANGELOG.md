# Changelog

## std - vNext

> Note: vNext denotes changes that haven't been included in a new std version yet, because they haven't altered the public API signatures.

### Bugfixes

- Trailing slashes will be properly preserved when used to indicate that the request can only be a folder.

### Errors

- A new type of error has been added: `BUILTIN_NODE_RESOLUTION_DISABLED`. Used when the request isn't part of the dependency tree, but is a builtin node module and the `considerBuiltins` option is disabled (e.g. in bundled applications that run outside of a NodeJS context).

- `MISSING_PEER_DEPENDENCY` errors will also include the ancestors breaking the chain.
