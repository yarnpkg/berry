const {execute} = require(`@yarnpkg/monorepo/scripts/extract-hooks`);

const fs = require(`fs`);
const path = require(`path`);

exports.sourceNodes = async ({actions, createNodeId, createContentDigest}, opts) => {
  const {createNode} = actions;

  const packageDirectory = path.resolve(__dirname, `../..`);
  const packageList = fs.readdirSync(packageDirectory);

  const indexList = packageList.map(name => {
    return path.join(packageDirectory, name, `sources/index.ts`);
  }).filter(path => {
    try {
      return fs.existsSync(path);
    } catch (err) {
      return false;
    }
  });

  const data = await execute([
    require.resolve(`@yarnpkg/monorepo/packages/yarnpkg-core/sources/Plugin.ts`),
    ...indexList,
  ]);

  createNode({
    id: createNodeId(`yarn-hooks`),
    parent: null,
    children: [],
    internal: {
      type: `YarnIntrospection`,
      mediaType: `application/json`,
      contentDigest: createContentDigest(JSON.stringify(data)),
    },
    value: data,
  });
};
