
import {Hooks as CoreHooks, Descriptor, Workspace} from '@yarnpkg/core';
import {Hooks as EssentialsHooks}                  from '@yarnpkg/plugin-essentials';

import {InstallCommand}                            from './commands/install';
import {UninstallCommand}                          from './commands/uninstall';
import {ViewCommand}                               from './commands/view';


const installedDependencies: Array<[Workspace, Descriptor]> = [];

let emitNpmCompatOutput = false;
export function enableNpmCompatOutput() {
  emitNpmCompatOutput = true;
}

export const hooks: EssentialsHooks & CoreHooks = {
  async setupScriptEnvironment(project, env, makePathWrapper) {
    await makePathWrapper(`npm`, process.execPath, [process.argv[1], 'npm']);
  },
  async afterWorkspaceDependencyAddition(workspace, target, descriptor) {
    installedDependencies.push([workspace, descriptor]);
  },
  async afterWorkspaceDependencyReplacement(workspace, target, from, to) {
    installedDependencies.push([workspace, to]);
  },
  async afterAllInstalled(project) {
    if (installedDependencies.length && emitNpmCompatOutput) {
      console.log('NPM compat output:');
      for (const [workspace, ident] of installedDependencies) {
        const descriptor = workspace.dependencies.get(ident.identHash)!;
        const resolution = project.storedResolutions.get(descriptor.descriptorHash)!;
        const pkg = project.storedPackages.get(resolution)!;
        console.log(`+ ${pkg.name}@${pkg.version}`);
      }
    }
  },
};

export const commands = [InstallCommand, ViewCommand, UninstallCommand];
