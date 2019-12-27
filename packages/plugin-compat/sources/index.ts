import {Hooks as CoreHooks, Plugin, structUtils} from '@yarnpkg/core';
import {Hooks as PatchHooks}                     from '@yarnpkg/plugin-patch';

import {patch as typescriptPatch}                from './patches/typescript-1';

const PATCHES = new Map([
  [structUtils.makeIdent(null, `typescript`).identHash, typescriptPatch],
]);

const plugin: Plugin<CoreHooks & PatchHooks> = {
  hooks: {
    getBuiltinPatch: async (project, name) => {
      const TAG = `compat/`;
      if (!name.startsWith(TAG))
        return;

      const ident = structUtils.parseIdent(name.slice(TAG.length));
      const patch = PATCHES.get(ident.identHash);

      return typeof patch !== `undefined` ? patch : null;
    },

    reduceDependency: async (dependency, project, locator, initialDescriptor) => {
      const patch = PATCHES.get(dependency.identHash);
      if (typeof patch === `undefined`)
        return dependency;

      return structUtils.makeDescriptor(dependency, structUtils.makeRange({
        protocol: `patch:`,
        source: structUtils.stringifyDescriptor(dependency),
        selector: `builtin<compat/${structUtils.stringifyIdent(dependency)}>`,
        params: null,
      }));
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
