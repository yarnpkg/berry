import {Plugin}    from '@berry/core';

import {PnpLinker} from './PnpLinker';

const plugin: Plugin = {
  linkers: [
    PnpLinker,
  ],
};

export default plugin;
