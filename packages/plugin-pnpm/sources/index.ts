import {Plugin}     from '@yarnpkg/core';

import {PnpmLinker} from './PnpmLinker';

const plugin: Plugin = {
  linkers: [
    PnpmLinker,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
