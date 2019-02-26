// Note that this file isn't the real export - it is run at build-time and its
// return value is what's used within the bundle (cf val-loader).

module.exports = ({modules, plugins}) => {
  return {code: `module.exports = {\n  modules: new Map([\n${modules.map(request => 
    `    [${JSON.stringify(request)}, require(${JSON.stringify(request)}).default],\n`
  ).join(``)}\n  ]),\n  plugins: new Set([\n${plugins.map(request =>
    `    ${JSON.stringify(request)},\n`
  ).join(``)}\n  ]),\n};\n`};
};
