// @ts-ignore
import {dependencies}        from '@yarnpkg/cli/package.json';
import {PluginConfiguration} from '@yarnpkg/core';

export function getPluginConfiguration(): PluginConfiguration {
  const plugins = new Set<string>();
  for (const dependencyName of Object.keys(dependencies))
    if (dependencyName.startsWith(`@yarnpkg/plugin-`))
      plugins.add(dependencyName);

  const modules = new Map<string, string>();
  for (const plugin of plugins)
    modules.set(plugin, require(plugin).default);

  return {plugins, modules};
}
