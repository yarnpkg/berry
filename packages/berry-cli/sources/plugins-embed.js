module.exports = function({plugins}) {
  return {code: `module.exports = new Map([${plugins.map(plugin => `[${JSON.stringify(plugin)}, require(${JSON.stringify(plugin)}).default]`).join(`,`)}]);`};
};
