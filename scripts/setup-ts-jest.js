const {createHash} = require(`node:crypto`);
const {compileFile, version} = require(`./setup-ts-cache.js`);

module.exports = {
  getCacheKey(sourceText, sourcePath, transformOptions) {
    return createHash(`sha1`)
      .update(sourceText)
      .update(`\0`)
      .update(version)
      .digest(`hex`)
      .substring(0, 32);
  },
  process(sourceText, sourcePath, options) {
    if (/[\\/]node_modules[\\/]/.test(sourcePath)) {
      return {
        code: sourceText,
      };
    }

    return compileFile(sourceText, sourcePath);
  },
};
