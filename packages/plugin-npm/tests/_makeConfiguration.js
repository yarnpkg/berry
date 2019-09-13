import {Configuration} from '@yarnpkg/core';

export const makeConfiguration = () => Configuration.find(__dirname, {
  modules: new Map([
    [`@yarnpkg/core`, require(`@yarnpkg/core`)],
    [`@yarnpkg/fslib`, require(`@yarnpkg/core`)],
    [`@yarnpkg/plugin-npm`, require(`@yarnpkg/plugin-npm`)],
  ]),
  plugins: new Set([
    `@yarnpkg/plugin-npm`,
  ]),
}, {
  useRc: false,
  strict: false,
});
