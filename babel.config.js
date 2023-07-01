module.exports = {
  targets: {
    node: `current`,
  },
  presets: [
    [`@babel/preset-env`, {modules: `commonjs`}],
    `@babel/preset-typescript`,
    `@babel/preset-react`,
  ],
};
