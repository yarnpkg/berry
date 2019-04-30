# `@berry/plugin-typescript`

This plugin automatically adds `@types/` packages into your dependencies when you add a package that's covered by one.

## Usage

Since Yarn doesn't support dynamic linking yet, you must clone this repository and generate a bundle manually:

```
$ yarn build:cli --plugin @berry/plugin-typescript
```

Then put the generated file (`packages/berry-cli/bin/berry.js`) into your project. You can easily try it out by running `yarn add lodash` somewhere:

```
❯ berry/packages/plugin-typescript ❯ yarn add lodash

➤ BR0000: ┌ Resolution step
➤ BR0002: │ babel-preset-jest@npm:24.1.0 doesn't provide @babel/core@^7.0.0-0 requested by @babel/plugin-syntax-object-rest-spread@npm:7.2.0
➤ BR0000: └ Completed in 0.24s
➤ BR0000: ┌ Fetch step
➤ BR0013: │ @types/lodash@npm:4.14.121 can't be found in the cache and will be fetched from the remote registry
➤ BR0000: └ Completed in 3.63s
➤ BR0000: ┌ Link step
➤ BR0005: │ webpack-cli@npm:3.2.1 lists build scripts, but its build has been explicitly disabled through configuration.
➤ BR0005: │ fsevents@npm:1.2.6 lists build scripts, but its build has been explicitly disabled through configuration.
➤ BR0005: │ webpack-cli@npm:3.2.1 lists build scripts, but its build has been explicitly disabled through configuration.
➤ BR0005: │ webpack-cli@npm:3.2.1 lists build scripts, but its build has been explicitly disabled through configuration.
➤ BR0000: └ Completed in 2.75s
➤ BR0000: Done with warnings in 6.81s
```

As you can see in the fetch step, even though you only added `lodash` into your dependencies Yarn got smart enough to figure out that you also need `@types/lodash`.
