// Don't modify this script directly! Instead, run:
// yarn build:plugin-commands

export const pluginCommands = new Map([
  [`constraints`, [
    [`constraints`, `query`],
    [`constraints`, `source`],
    [`constraints`],
  ]],
  [`interactive-tools`, [
    [`search`],
    [`upgrade-interactive`],
  ]],
  [`stage`, [
    [`stage`],
  ]],
  [`version`, [
    [`version`, `apply`],
    [`version`, `check`],
    [`version`],
  ]],
  [`workspace-tools`, [
    [`workspaces`, `focus`],
    [`workspaces`, `foreach`],
  ]],
]);
