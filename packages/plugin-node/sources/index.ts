import {Plugin}     from '@berry/core';

import {NodeLinker} from './NodeLinker';

const plugin: Plugin = {
  linkers: [
    new NodeLinker(),
  ],
};

export default plugin;
