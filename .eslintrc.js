module.exports = {
  extends: [
    `@yarnpkg`,
    `@yarnpkg/eslint-config/react`
  ],
  ignorePatterns: [
    `packages/plugin-compat/extra/fsevents/fsevents-*.js`,
  ]
};
