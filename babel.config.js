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
    `packages/berry-libzip/sources/libzip.js`,
  ],
};
