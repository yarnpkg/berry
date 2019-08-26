module.exports = {
  plugins: [
    `@babel/plugin-transform-modules-commonjs`,
    [`@babel/plugin-proposal-decorators`, {legacy: true}],
    [`@babel/plugin-proposal-class-properties`, {loose: true}],
  ],
  presets: [
    `@babel/preset-typescript`,
  ],
  ignore: [
    `packages/yarnpkg-libzip/sources/libzip.js`,
  ],
};
