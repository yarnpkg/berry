// @ts-check

/** @type {import('@docusaurus/types').PluginModule} */
module.exports = (context, options) => {
  return {
    name: `yarnpkg-docusaurus-plugin`,
    configureWebpack(config) {
      for (const rule of config.module.rules)
        if (typeof rule === `object` && rule.test instanceof RegExp && rule.test.test?.(`/foo/bar.md`))
          if (Array.isArray(rule.use))
            rule.use?.push(require.resolve(`./webpack-md-require`));

      return {
        resolve: {
          fallback: {
            url: require.resolve(`url/`),
          },
        },
      };
    },
  };
};
