const path = require(`path`);

module.exports = function (source) {
  const cb = this.async();

  loader(this, source).then(result => {
    cb(null, result);
  }, err => {
    cb(err);
  });
};

async function loader(api, source) {
  const regex = /^import\s+from\s+([^;]+);$/gm;
  const replacements = [];

  source.replace(regex, ($0, $1) => {
    const relativePath = JSON.parse($1);
    const resolvedPath = relativePath.match(/^\.{0,2}\//)
      ? path.resolve(path.dirname(api.resourcePath), relativePath)
      : relativePath;

    api.addDependency(resolvedPath);

    replacements.push(Promise.resolve(require(resolvedPath)()));
  });

  const resolvedReplacements = await Promise.all(replacements);

  return source.replace(regex, ($0, $1) => {
    return resolvedReplacements.shift();
  });
}
