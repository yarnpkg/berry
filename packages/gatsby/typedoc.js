const path = require(`path`);

module.exports = {
  name: `Yarn API`,
  inputFiles: [`../.`],
  mode: `modules`,
  out: `./static/api`,
  theme: `${path.dirname(require.resolve(`typedoc-neo-theme/package.json`))}/bin/default`,
  plugin: [`typedoc-plugin-yarn`, `typedoc-neo-theme`, `@strictsoftware/typedoc-plugin-monorepo`],
  'external-modulemap': `.*packages/([^/]+)/.*`,
  ignoreCompilerErrors: true,
  links: [
    {
      label: `Home`,
      url: `/`,
    },
    {
      label: `Configuration`,
      url: `/configuration`,
    },
    {
      label: `Features`,
      url: `/features`,
    },
    {
      label: `CLI`,
      url: `/cli`,
    },
    {
      label: `Advanced`,
      url: `/advanced`,
    },
    {
      label: `GitHub`,
      url: `https://github.com/yarnpkg/berry`,
    },
  ],
  outline: [
    {
      "Generic Packages": {
        "@yarnpkg/core": `yarnpkg_core`,
        "@yarnpkg/fslib": `yarnpkg_fslib`,
        "@yarnpkg/json-proxy": `yarnpkg_json_proxy`,
        "@yarnpkg/libzip": `yarnpkg_libzip`,
        "@yarnpkg/parsers": `yarnpkg_parsers`,
        "@yarnpkg/pnp": `yarnpkg_pnp`,
        "@yarnpkg/pnpify": `yarnpkg_pnpify`,
        "@yarnpkg/shell": `yarnpkg_shell`,
      },
      "Yarn Packages": {
        "@yarnpkg/builder": `yarnpkg_builder`,
        "@yarnpkg/cli": `yarnpkg_cli`,
      },
      "Default Plugins": {
        "@yarnpkg/plugin-compat": `plugin_compat`,
        "@yarnpkg/plugin-dlx": `plugin_dlx`,
        "@yarnpkg/plugin-essentials": `plugin_essentials`,
        "@yarnpkg/plugin-file": `plugin_file`,
        "@yarnpkg/plugin-git": `plugin_git`,
        "@yarnpkg/plugin-github": `plugin_github`,
        "@yarnpkg/plugin-http": `plugin_http`,
        "@yarnpkg/plugin-init": `plugin_init`,
        "@yarnpkg/plugin-link": `plugin_link`,
        "@yarnpkg/plugin-node-modules": `plugin_node_modules`,
        "@yarnpkg/plugin-npm": `plugin_npm`,
        "@yarnpkg/plugin-npm-cli": `plugin_npm_cli`,
        "@yarnpkg/plugin-pack": `plugin_pack`,
        "@yarnpkg/plugin-patch": `plugin_patch`,
        "@yarnpkg/plugin-pnp": `plugin_pnp`,
      },
      "Contrib Plugins": {
        "@yarnpkg/plugin-constraints": `plugin_constraints`,
        "@yarnpkg/plugin-exec": `plugin_exec`,
        "@yarnpkg/plugin-interactive-tools": `plugin_interactive_tools`,
        "@yarnpkg/plugin-stage": `plugin_stage`,
        "@yarnpkg/plugin-typescript": `plugin_typescript`,
        "@yarnpkg/plugin-version": `plugin_version`,
        "@yarnpkg/plugin-workspace-tools": `plugin_workspace_tools`,
      },
    },
  ],
  source: [
    {
      path: `https://github.com/yarnpkg/berry/tree/master/`,
      line: `L`,
    },
  ],
};
