# `@yarnpkg/plugin-typescript`

This plugin automatically adds `@types/` packages into your dependencies when you add a package that's covered by one.

Note that for performance reasons the plugin doesn't try to check whether the added package contains its own types - so you might end up with extraneous type packages in some cases.

## Usage

**Note:** This plugin (as all other Yarn plugins) is only compatible with Yarn 2. Yarn 2 is still in a "developer preview" state, meaning that you're welcome to use it and give us your feedback but you might have to get your hands a little dirty to dive into the mechanic.

1. [Install Yarn](https://github.com/yarnpkg/berry#install)

2. Install the `@yarnpkg/plugin-typescript` plugin:

   ```
   $ yarn plugin import @yarnpkg/plugin-typescript
   ```

## Example

```
❯ yarn/packages/plugin-typescript ❯ yarn add lodash

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

As you can see in the fetch step, even though we only added `lodash` into our dependencies, Yarn automatically figured out that we would need `@types/lodash` and added it.
