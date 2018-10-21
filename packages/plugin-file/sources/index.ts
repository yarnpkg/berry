import {Plugin}              from '@berry/core';

import {FileFetcher}         from './FileFetcher';
import {FileResolver}        from './FileResolver';
import {TarballFileFetcher}  from './TarballFileFetcher';
import {TarballFileResolver} from './TarballFileResolver';

const plugin: Plugin = {
  fetchers: [
    new TarballFileFetcher(),
    new FileFetcher(),
  ],
  resolvers: [
    new TarballFileResolver(),
    new FileResolver(),
  ],
};

export default plugin;
