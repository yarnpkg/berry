import {Plugin}            from '@yarnpkg/core';

import {NodeModulesLinker} from './NodeModulesLinker';

const plugin: Plugin = {
  linkers: [
    NodeModulesLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
