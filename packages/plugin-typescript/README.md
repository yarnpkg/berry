# `@yarnpkg/plugin-typescript`

## Features

- Automatically adds `@types/` packages into your dependencies when you add a package that doesn't include its own types
- Adds support for `types` to `publishConfig` (same behavior as [`publishConfig.bin`](https://yarnpkg.com/configuration/manifest#publishConfig.bin))

## Install

```bash
yarn plugin import typescript
```

## Example

```
❯ yarn/packages/plugin-typescript ❯ yarn add lodash

➤ YN0000: ┌ Resolution step
➤ YN0000: └ Completed in 0.24s
➤ YN0000: ┌ Fetch step
➤ YN0013: │ @types/lodash@npm:4.14.121 can't be found in the cache and will be fetched from the remote registry
➤ YN0013: │ lodash@npm:4.14.0 can't be found in the cache and will be fetched from the remote registry
➤ YN0000: └ Completed in 3.63s
➤ YN0000: ┌ Link step
➤ YN0000: └ Completed in 2.75s
➤ YN0000: Done with warnings in 6.81s
```

As you can see in the fetch step, even though we only added `lodash` into our dependencies, Yarn automatically figured out that we would need `@types/lodash`, and added it before we ask it to.
