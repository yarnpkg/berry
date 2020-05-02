// Note that this file isn't the real export - it is run at build-time and its
// return value is what's used within the bundle (cf val-loader).

module.exports = ({modules, plugins}) => {
  return {code: `exports.getPluginConfiguration = () => ({\n  modules: new Map([\n${modules.map(request =>
    `    [require(${JSON.stringify(`${request}/package.json`)}).name, require(${JSON.stringify(request)})],\n`
  ).join(``)}\n  ]),\n  plugins: new Set([\n${plugins.map(request =>
    `    require(${JSON.stringify(`${request}/package.json`)}).name,\n`
  ).join(``)}\n  ]),\n});\n`};
};
