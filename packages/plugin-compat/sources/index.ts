import {Hooks as CoreHooks, Plugin, structUtils} from '@yarnpkg/core';
import {Hooks as PatchHooks}                     from '@yarnpkg/plugin-patch';

import {packageExtensions}                       from './extensions';
import {getPatch as getFseventsPatch}            from './patches/fsevents.patch';
import {getPatch as getResolvePatch}             from './patches/resolve.patch';
import {getPatch as getTypescriptPatch}          from './patches/typescript.patch';

const PATCHES = new Map([
  [structUtils.makeIdent(null, `fsevents`).identHash, getFseventsPatch],
  [structUtils.makeIdent(null, `resolve`).identHash, getResolvePatch],
  [structUtils.makeIdent(null, `typescript`).identHash, getTypescriptPatch],
]);

const plugin: Plugin<CoreHooks & PatchHooks> = {
  hooks: {
    registerPackageExtensions: async (configuration, registerPackageExtension) => {
      for (const [descriptorStr, extensionData] of packageExtensions) {
        registerPackageExtension(structUtils.parseDescriptor(descriptorStr, true), extensionData);
      }
    },

    getBuiltinPatch: async (project, name) => {
      const TAG = `compat/`;
      if (!name.startsWith(TAG))
        return undefined;

      const ident = structUtils.parseIdent(name.slice(TAG.length));
      const patch = PATCHES.get(ident.identHash)?.();

      return typeof patch !== `undefined` ? patch : null;
    },

    reduceDependency: async (dependency, project, locator, initialDescriptor) => {
      const patch = PATCHES.get(dependency.identHash);
      if (typeof patch === `undefined`)
        return dependency;

      return structUtils.makeDescriptor(dependency, structUtils.makeRange({
        protocol: `patch:`,
        source: structUtils.stringifyDescriptor(dependency),
        selector: `optional!builtin<compat/${structUtils.stringifyIdent(dependency)}>`,
        params: null,
      }));
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
