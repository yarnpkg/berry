// Note that this file isn't the real export - it is run at build-time and its
// return value is what's used within the bundle (cf val-loader).

module.exports = ({modules, plugins}) => {
  const importSegment = modules.map((request, index) => {
    return `import _${index} from ${JSON.stringify(request)};\n`;
  }).join(``);

  const moduleSegment = `const modules = new Map([\n${modules.map((request, index) => {
    return `  [${JSON.stringify(require(`${request}/package.json`).name)}, _${index}],\n`;
  }).join(``)}]);\n`;

  const pluginSegment = `const plugins = new Set([\n${plugins.map(request => {
    return `  [${JSON.stringify(require(`${request}/package.json`).name)}],\n`;
  })}]);\n`;

  return {
    code: [
      importSegment,
      moduleSegment,
      pluginSegment,
      `export const getPluginConfiguration = () => ({modules, plugins});\n`,
    ].join(`\n`),
  };
};
