module.exports = {
  plugins: [
    `@babel/plugin-transform-modules-commonjs`,
    `@babel/plugin-proposal-optional-chaining`,
    [`@babel/plugin-proposal-decorators`, {legacy: true}],
    [`@babel/plugin-proposal-class-properties`, {loose: true}],
    `@babel/plugin-proposal-async-generator-functions`,
  ],
  presets: [
    `@babel/preset-typescript`,
    `@babel/preset-react`,
  ],
  ignore: [
    `**/*.d.ts`,
    `packages/yarnpkg-libzip/sources/libzip.js`,
  ],
};
