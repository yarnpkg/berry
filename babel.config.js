module.exports = {
  plugins: [
    `@babel/plugin-transform-modules-commonjs`,
    `@babel/plugin-proposal-class-properties`,
  ],
  presets: [
    `@babel/preset-typescript`,
  ],
  ignore: [
    `packages/berry-libzip/sources/libzip.js`,
  ],
};
