module.exports = {
  extends: [
    require.resolve(`@yarnpkg/eslint-config`),
    require.resolve(`@yarnpkg/eslint-config/react`),
  ],
  ignorePatterns: [
    `packages/plugin-compat/extra/fsevents/fsevents-*.js`,
  ],
};
