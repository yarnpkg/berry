import {MessageName, Plugin, ReportError, structUtils} from '@yarnpkg/core';

import {ExecFetcher, ExecEnv} from './ExecFetcher';
import {ExecResolver}         from './ExecResolver';
import {PROTOCOL}             from './constants';
import * as execUtils         from './execUtils';

export type {ExecEnv};
export {execUtils};
export {ExecFetcher};
export {ExecResolver};

const plugin: Plugin = {
  hooks: {
    reduceDependency: (dependency, project, locator) => {
      if (project.tryWorkspaceByLocator(locator) === null && dependency.range.startsWith(PROTOCOL))
        throw new ReportError(MessageName.INVALID_MANIFEST, `${structUtils.prettyLocator(project.configuration, locator)} lists ${structUtils.prettyDescriptor(project.configuration, dependency)} as dependency, but only workspaces can depend on exec: packages.`);

      return dependency;
    },
  },
  fetchers: [
    ExecFetcher,
  ],
  resolvers: [
    ExecResolver,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
