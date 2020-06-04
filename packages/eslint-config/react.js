module.exports = {
  extends: [
    `./rules/react`,
  ].map(require.resolve),
};
