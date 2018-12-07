import {Plugin}    from '@berry/core';

import {PnpLinker} from './PnpLinker';

const plugin: Plugin = {
  linkers: [
    new PnpLinker(),
  ],
};

export default plugin;
