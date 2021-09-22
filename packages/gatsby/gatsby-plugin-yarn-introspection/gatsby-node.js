const {execute}  = require(`@yarnpkg/monorepo/scripts/extract-hooks`);

exports.sourceNodes = async ({actions, createNodeId, createContentDigest}, opts) => {
  const {createNode} = actions;

  const data = await execute([
    require.resolve(`@yarnpkg/monorepo/packages/yarnpkg-core/sources/Plugin.ts`),
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
