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

    reduceDescriptorAlias: async (alias, project, descriptor) => {
      const patch = PATCHES.get(alias.identHash);
      if (typeof patch === `undefined`)
        return alias;

      return structUtils.makeDescriptor(descriptor, structUtils.makeRange({
        protocol: `patch:`,
        source: structUtils.stringifyDescriptor(descriptor),
        selector: `builtin<compat/${structUtils.stringifyIdent(descriptor)}>`,
        params: null,
      }));
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
