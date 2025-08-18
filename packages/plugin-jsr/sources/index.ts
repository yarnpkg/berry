import {Plugin, Workspace}             from '@yarnpkg/core';
import {structUtils}                   from '@yarnpkg/core';

import {JsrFetcher}                    from './JsrFetcher';
import {JsrResolver}                   from './JsrResolver';
import {convertDescriptorFromJsrToNpm} from './helpers';

const DEPENDENCY_TYPES = [`dependencies`, `devDependencies`, `peerDependencies`];

function beforeWorkspacePacking(workspace: Workspace, rawManifest: any) {
  for (const dependencyType of DEPENDENCY_TYPES) {
    for (const descriptor of workspace.manifest.getForScope(dependencyType).values()) {
      if (!descriptor.range.startsWith(`jsr:`))
        continue;

      const normalizedDescriptor = convertDescriptorFromJsrToNpm(descriptor);

      // Ensure optional dependencies are handled as well
      const identDescriptor = dependencyType === `dependencies`
        ? structUtils.makeDescriptor(descriptor, `unknown`)
        : null;

      const finalDependencyType = identDescriptor !== null && workspace.manifest.ensureDependencyMeta(identDescriptor).optional
        ? `optionalDependencies`
        : dependencyType;

      rawManifest[finalDependencyType][structUtils.stringifyIdent(descriptor)] = normalizedDescriptor.range;
    }
  }
}

const plugin: Plugin = {
  hooks: {
    beforeWorkspacePacking,
  },
  resolvers: [
    JsrResolver,
  ],
  fetchers: [
    JsrFetcher,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
