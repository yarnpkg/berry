const plugin = require(`./plugin`);

module.exports = PluginHost => {
  const app = PluginHost.owner;

  app.converter.addComponent(`yarn-plugin`, plugin.YarnPlugin);
};
